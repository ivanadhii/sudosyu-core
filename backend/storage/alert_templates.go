package storage

import (
	"context"
	"fmt"
)

func (db *DB) ListAlertTemplates(ctx context.Context) ([]AlertTemplate, error) {
	rows, err := db.Pool.Query(ctx,
		`SELECT id, name, created_at FROM alert_templates ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var templates []AlertTemplate
	for rows.Next() {
		var t AlertTemplate
		if err := rows.Scan(&t.ID, &t.Name, &t.CreatedAt); err != nil {
			return nil, err
		}
		t.Rules = []AlertTemplateRule{}
		templates = append(templates, t)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Load rules for each template
	for i := range templates {
		rules, err := db.getTemplateRules(ctx, templates[i].ID)
		if err != nil {
			return nil, err
		}
		templates[i].Rules = rules
	}
	return templates, nil
}

func (db *DB) getTemplateRules(ctx context.Context, templateID string) ([]AlertTemplateRule, error) {
	rows, err := db.Pool.Query(ctx,
		`SELECT id, template_id, metric, condition, threshold, duration_seconds, webhook_url
		 FROM alert_template_rules WHERE template_id = $1 ORDER BY metric`,
		templateID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rules []AlertTemplateRule
	for rows.Next() {
		var r AlertTemplateRule
		if err := rows.Scan(&r.ID, &r.TemplateID, &r.Metric, &r.Condition, &r.Threshold, &r.DurationSeconds, &r.WebhookURL); err != nil {
			return nil, err
		}
		rules = append(rules, r)
	}
	if rules == nil {
		rules = []AlertTemplateRule{}
	}
	return rules, rows.Err()
}

func (db *DB) CreateAlertTemplate(ctx context.Context, name string, rules []AlertTemplateRule) (*AlertTemplate, error) {
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var t AlertTemplate
	if err := tx.QueryRow(ctx,
		`INSERT INTO alert_templates (name) VALUES ($1) RETURNING id, name, created_at`,
		name).Scan(&t.ID, &t.Name, &t.CreatedAt); err != nil {
		return nil, fmt.Errorf("create template: %w", err)
	}

	for _, r := range rules {
		if err := tx.QueryRow(ctx,
			`INSERT INTO alert_template_rules (template_id, metric, condition, threshold, duration_seconds, webhook_url)
			 VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
			t.ID, r.Metric, r.Condition, r.Threshold, r.DurationSeconds, r.WebhookURL).Scan(&r.ID); err != nil {
			return nil, fmt.Errorf("create template rule: %w", err)
		}
		r.TemplateID = t.ID
		t.Rules = append(t.Rules, r)
	}
	if t.Rules == nil {
		t.Rules = []AlertTemplateRule{}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &t, nil
}

func (db *DB) DeleteAlertTemplate(ctx context.Context, id string) error {
	_, err := db.Pool.Exec(ctx, `DELETE FROM alert_templates WHERE id = $1`, id)
	return err
}

// ApplyAlertTemplate creates alerts for all rules in a template for the given server.
func (db *DB) ApplyAlertTemplate(ctx context.Context, templateID, serverID string) error {
	rules, err := db.getTemplateRules(ctx, templateID)
	if err != nil {
		return err
	}
	for _, r := range rules {
		_, err := db.CreateAlert(ctx, Alert{
			ServerID:        serverID,
			Metric:          r.Metric,
			Condition:       r.Condition,
			Threshold:       r.Threshold,
			DurationSeconds: r.DurationSeconds,
			Channel:         "webhook",
			WebhookURL:      r.WebhookURL,
		})
		if err != nil {
			return fmt.Errorf("apply template rule %s: %w", r.Metric, err)
		}
	}
	return nil
}
