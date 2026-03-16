package alerting

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/sudosyu/core/backend/storage"
)

type Engine struct {
	db *storage.DB
}

func New(db *storage.DB) *Engine {
	return &Engine{db: db}
}

func (e *Engine) Run(ctx context.Context) {
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			e.evaluateMetricAlerts(ctx)
			e.evaluateContainerWatches(ctx)
		}
	}
}

// --- Metric alerts (cpu, ram, disk, unreachable) ---

func (e *Engine) evaluateMetricAlerts(ctx context.Context) {
	alerts, err := e.db.GetAllAlerts(ctx)
	if err != nil || len(alerts) == 0 {
		return
	}

	for _, alert := range alerts {
		if !alert.Active {
			continue
		}
		if alert.Metric == "unreachable" {
			e.evaluateUnreachable(ctx, alert)
		} else {
			e.evaluateMetric(ctx, alert)
		}
	}
}

func (e *Engine) evaluateUnreachable(ctx context.Context, alert storage.Alert) {
	server, err := e.db.GetServerByID(ctx, alert.ServerID)
	if err != nil {
		return
	}

	timeoutSeconds := alert.Threshold
	breach := server.LastSeenAt == nil || time.Since(*server.LastSeenAt).Seconds() > timeoutSeconds

	openID, isFiring := e.db.GetOpenAlertHistory(ctx, alert.ID)
	if breach && !isFiring {
		var ago float64
		if server.LastSeenAt != nil {
			ago = time.Since(*server.LastSeenAt).Seconds()
		}
		histID, err := e.db.OpenAlertHistory(ctx, alert.ID, alert.ServerID, ago)
		if err != nil {
			log.Printf("alert engine: open history error: %v", err)
		}
		log.Printf("alert engine: UNREACHABLE server %s (last seen %.0fs ago)", alert.ServerID, ago)
		e.sendWebhook(alert.WebhookURL, discordEmbed{
			Title: "🔴 Server Unreachable",
			Color: 15158332,
			Fields: []discordField{
				{Name: "Server", Value: alert.ServerName, Inline: true},
				{Name: "Last Seen", Value: fmt.Sprintf("%.0f seconds ago", ago), Inline: true},
				{Name: "Timeout", Value: fmt.Sprintf("%.0fs", timeoutSeconds), Inline: true},
			},
		})
		_ = histID
	} else if !breach && isFiring {
		_ = e.db.ResolveAlertHistory(ctx, openID, 0)
		log.Printf("alert engine: server %s is reachable again", alert.ServerID)
		e.sendWebhook(alert.WebhookURL, discordEmbed{
			Title: "✅ Server Reachable",
			Color: 5763719,
			Fields: []discordField{
				{Name: "Server", Value: alert.ServerName, Inline: true},
			},
		})
	}
}

func (e *Engine) evaluateMetric(ctx context.Context, alert storage.Alert) {
	queryWindow := time.Duration(alert.DurationSeconds) * time.Second
	if queryWindow < 60*time.Second {
		queryWindow = 60 * time.Second
	}
	now := time.Now()
	points, err := e.db.QueryMetrics(ctx, storage.QueryMetricsParams{
		ServerID:   alert.ServerID,
		MetricType: alert.Metric,
		MetricName: metricNameFor(alert.Metric),
		Start:      now.Add(-queryWindow),
		End:        now,
		Resolution: "raw",
	})
	if err != nil || len(points) == 0 {
		return
	}

	cutoff := now.Add(-time.Duration(alert.DurationSeconds) * time.Second)
	var recent []storage.MetricPoint
	for _, p := range points {
		if !p.Time.Before(cutoff) {
			recent = append(recent, p)
		}
	}
	if len(recent) == 0 {
		return
	}

	breach := true
	var lastValue float64
	for _, p := range recent {
		lastValue = p.Value
		if alert.Condition == "gt" && p.Value <= alert.Threshold {
			breach = false
			break
		}
		if alert.Condition == "lt" && p.Value >= alert.Threshold {
			breach = false
			break
		}
	}

	openID, isFiring := e.db.GetOpenAlertHistory(ctx, alert.ID)
	if breach && !isFiring {
		histID, err := e.db.OpenAlertHistory(ctx, alert.ID, alert.ServerID, lastValue)
		if err != nil {
			log.Printf("alert engine: open history error: %v", err)
		}
		condStr := ">"
		if alert.Condition == "lt" {
			condStr = "<"
		}
		log.Printf("alert engine: FIRING alert %s (%.2f %s %.2f)", alert.ID, lastValue, alert.Condition, alert.Threshold)
		e.sendWebhook(alert.WebhookURL, discordEmbed{
			Title: "🔥 Alert Triggered",
			Color: 15158332,
			Fields: []discordField{
				{Name: "Server", Value: alert.ServerName, Inline: true},
				{Name: "Metric", Value: alert.Metric, Inline: true},
				{Name: "Value", Value: fmt.Sprintf("%.2f%%", lastValue), Inline: true},
				{Name: "Threshold", Value: fmt.Sprintf("%s %.2f%%", condStr, alert.Threshold), Inline: true},
				{Name: "Duration", Value: fmt.Sprintf("%ds", alert.DurationSeconds), Inline: true},
			},
		})
		_ = histID
	} else if !breach && isFiring {
		_ = e.db.ResolveAlertHistory(ctx, openID, lastValue)
		log.Printf("alert engine: RESOLVED alert %s (%.2f)", alert.ID, lastValue)
		e.sendWebhook(alert.WebhookURL, discordEmbed{
			Title: "✅ Alert Resolved",
			Color: 5763719,
			Fields: []discordField{
				{Name: "Server", Value: alert.ServerName, Inline: true},
				{Name: "Metric", Value: alert.Metric, Inline: true},
				{Name: "Value", Value: fmt.Sprintf("%.2f%%", lastValue), Inline: true},
			},
		})
	}
}

// --- Container watches ---

func (e *Engine) evaluateContainerWatches(ctx context.Context) {
	watches, err := e.db.GetAllContainerWatches(ctx)
	if err != nil || len(watches) == 0 {
		return
	}

	for _, w := range watches {
		currentStatus, currentID, found := e.db.GetLatestContainerByName(ctx, w.ServerID, w.ContainerName)
		if !found {
			currentStatus = "gone"
			currentID = ""
		}

		log.Printf("container watch: %s — last=%q/%s current=%q/%s",
			w.ContainerName, w.LastStatus, shortID(w.LastContainerID), currentStatus, shortID(currentID))

		// First time — just record, don't alert
		if w.LastStatus == "" {
			_ = e.db.UpdateContainerWatchState(ctx, w.ID, currentStatus, currentID)
			continue
		}

		statusChanged := currentStatus != w.LastStatus
		// Redeployed: same name, both running, but container ID changed
		// If lastContainerID was empty (e.g. fresh column), just record the ID silently
		redeployed := currentID != "" && w.LastContainerID != "" &&
			currentID != w.LastContainerID && currentStatus == "running"
		idUpdated := currentID != "" && w.LastContainerID == ""

		if !statusChanged && !redeployed {
			// Still update ID silently if we didn't have it yet
			if idUpdated {
				_ = e.db.UpdateContainerWatchState(ctx, w.ID, currentStatus, currentID)
			}
			continue
		}

		if redeployed && !statusChanged {
			// Container ID changed but still running = redeploy
			log.Printf("alert engine: container %s redeployed (id %s → %s)",
				w.ContainerName, shortID(w.LastContainerID), shortID(currentID))
			e.sendWebhook(w.WebhookURL, discordEmbed{
				Title: "🚀 Container Redeployed",
				Color: 3447003, // blue
				Fields: []discordField{
					{Name: "Container", Value: w.ContainerName, Inline: true},
					{Name: "Server", Value: w.ServerName, Inline: true},
					{Name: "Old ID", Value: shortID(w.LastContainerID), Inline: true},
					{Name: "New ID", Value: shortID(currentID), Inline: true},
				},
			})
		} else if statusChanged {
			// Status changed
			log.Printf("alert engine: container %s changed: %s → %s", w.ContainerName, w.LastStatus, currentStatus)

			color := 15158332
			title := "⚠️ Container State Changed"
			switch currentStatus {
			case "running":
				color = 5763719
				title = "✅ Container Running"
			case "exited":
				title = "🔴 Container Exited"
			case "restarting":
				color = 16776960
				title = "🔄 Container Restarting"
			case "gone":
				title = "💀 Container Disappeared"
			}

			fields := []discordField{
				{Name: "Container", Value: w.ContainerName, Inline: true},
				{Name: "Server", Value: w.ServerName, Inline: true},
				{Name: "Was", Value: w.LastStatus, Inline: true},
				{Name: "Now", Value: currentStatus, Inline: true},
			}
			// If running with a new ID, mention it's a redeploy
			if currentStatus == "running" && redeployed {
				title = "🚀 Container Redeployed"
				color = 3447003
				fields = append(fields, discordField{Name: "New ID", Value: shortID(currentID), Inline: true})
			}

			e.sendWebhook(w.WebhookURL, discordEmbed{Title: title, Color: color, Fields: fields})
		}

		_ = e.db.UpdateContainerWatchState(ctx, w.ID, currentStatus, currentID)
	}
}

func shortID(id string) string {
	if len(id) >= 12 {
		return id[:12]
	}
	return id
}

// --- Helpers ---

func metricNameFor(metricType string) string {
	switch metricType {
	case "cpu":
		return "total"
	case "ram":
		return "used_percent"
	case "disk":
		return "used_percent"
	default:
		return "total"
	}
}

type discordField struct {
	Name   string `json:"name"`
	Value  string `json:"value"`
	Inline bool   `json:"inline"`
}

type discordEmbed struct {
	Title  string         `json:"title"`
	Color  int            `json:"color"`
	Fields []discordField `json:"fields"`
}

func (e *Engine) sendWebhook(webhookURL string, embed discordEmbed) {
	payload := map[string]interface{}{
		"embeds": []discordEmbed{embed},
	}
	body, _ := json.Marshal(payload)
	resp, err := http.Post(webhookURL, "application/json", bytes.NewReader(body))
	if err != nil {
		log.Printf("alert webhook error: %v", err)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		log.Printf("alert webhook returned %d", resp.StatusCode)
	}
}
