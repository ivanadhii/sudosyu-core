package storage

import (
	"context"
)

func (db *DB) GetAlerts(ctx context.Context, serverID string) ([]Alert, error) {
	query := `SELECT id, server_id, metric, condition, threshold, duration_seconds, channel, webhook_url, active, created_at
	          FROM alerts WHERE server_id = $1 ORDER BY created_at DESC`
	rows, err := db.Pool.Query(ctx, query, serverID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var alerts []Alert
	for rows.Next() {
		var a Alert
		if err := rows.Scan(&a.ID, &a.ServerID, &a.Metric, &a.Condition, &a.Threshold,
			&a.DurationSeconds, &a.Channel, &a.WebhookURL, &a.Active, &a.CreatedAt); err != nil {
			return nil, err
		}
		alerts = append(alerts, a)
	}
	return alerts, rows.Err()
}

func (db *DB) GetAllAlerts(ctx context.Context) ([]Alert, error) {
	rows, err := db.Pool.Query(ctx,
		`SELECT a.id, a.server_id, s.name, a.metric, a.condition, a.threshold, a.duration_seconds, a.channel, a.webhook_url, a.active, a.created_at
		 FROM alerts a JOIN servers s ON s.id = a.server_id ORDER BY a.created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var alerts []Alert
	for rows.Next() {
		var a Alert
		if err := rows.Scan(&a.ID, &a.ServerID, &a.ServerName, &a.Metric, &a.Condition, &a.Threshold,
			&a.DurationSeconds, &a.Channel, &a.WebhookURL, &a.Active, &a.CreatedAt); err != nil {
			return nil, err
		}
		alerts = append(alerts, a)
	}
	return alerts, rows.Err()
}

func (db *DB) CreateAlert(ctx context.Context, a Alert) (*Alert, error) {
	err := db.Pool.QueryRow(ctx, `
		INSERT INTO alerts (server_id, metric, condition, threshold, duration_seconds, channel, webhook_url)
		VALUES ($1,$2,$3,$4,$5,$6,$7)
		RETURNING id, server_id, metric, condition, threshold, duration_seconds, channel, webhook_url, active, created_at`,
		a.ServerID, a.Metric, a.Condition, a.Threshold, a.DurationSeconds, a.Channel, a.WebhookURL,
	).Scan(&a.ID, &a.ServerID, &a.Metric, &a.Condition, &a.Threshold,
		&a.DurationSeconds, &a.Channel, &a.WebhookURL, &a.Active, &a.CreatedAt)
	return &a, err
}

func (db *DB) DeleteAlert(ctx context.Context, id string) error {
	_, err := db.Pool.Exec(ctx, `DELETE FROM alerts WHERE id = $1`, id)
	return err
}

// GetOpenAlertHistory returns the unresolved history entry for an alert, if any.
func (db *DB) GetOpenAlertHistory(ctx context.Context, alertID string) (string, bool) {
	var id string
	err := db.Pool.QueryRow(ctx,
		`SELECT id FROM alert_history WHERE alert_id = $1 AND resolved_at IS NULL ORDER BY fired_at DESC LIMIT 1`,
		alertID).Scan(&id)
	if err != nil {
		return "", false
	}
	return id, true
}

// OpenAlertHistory inserts a new unresolved history entry and returns its ID.
func (db *DB) OpenAlertHistory(ctx context.Context, alertID, serverID string, value float64) (string, error) {
	var id string
	err := db.Pool.QueryRow(ctx,
		`INSERT INTO alert_history (alert_id, server_id, value) VALUES ($1, $2, $3) RETURNING id`,
		alertID, serverID, value).Scan(&id)
	return id, err
}

// ResolveAlertHistory marks a history entry as resolved.
func (db *DB) ResolveAlertHistory(ctx context.Context, historyID string, value float64) error {
	_, err := db.Pool.Exec(ctx,
		`UPDATE alert_history SET resolved_at = NOW(), value = $2 WHERE id = $1`,
		historyID, value)
	return err
}
