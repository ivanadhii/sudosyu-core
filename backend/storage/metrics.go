package storage

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
)

type IngestPayload struct {
	ServerID string
	Time     time.Time
	Metrics  []MetricRow
}

type MetricRow struct {
	Type  string
	Name  string
	Value float64
}

func (db *DB) IngestMetrics(ctx context.Context, p IngestPayload) error {
	batch := &pgx.Batch{}
	for _, m := range p.Metrics {
		batch.Queue(
			`INSERT INTO metrics_raw (time, server_id, metric_type, metric_name, value) VALUES ($1, $2, $3, $4, $5)`,
			p.Time, p.ServerID, m.Type, m.Name, m.Value,
		)
	}
	br := db.Pool.SendBatch(ctx, batch)
	defer br.Close()
	for range p.Metrics {
		if _, err := br.Exec(); err != nil {
			return fmt.Errorf("ingest metric: %w", err)
		}
	}
	return nil
}

type QueryMetricsParams struct {
	ServerID   string
	MetricType string
	MetricName string
	Start      time.Time
	End        time.Time
	Resolution string // raw, 1m, 5m, 1h
}

func (db *DB) QueryMetrics(ctx context.Context, p QueryMetricsParams) ([]MetricPoint, error) {
	var query string
	switch p.Resolution {
	case "1m":
		query = `SELECT bucket AS time, value FROM metrics_1m
		          WHERE server_id = $1 AND metric_type = $2 AND metric_name = $3
		          AND bucket BETWEEN $4 AND $5 ORDER BY bucket`
	case "5m":
		query = `SELECT bucket AS time, value FROM metrics_5m
		          WHERE server_id = $1 AND metric_type = $2 AND metric_name = $3
		          AND bucket BETWEEN $4 AND $5 ORDER BY bucket`
	case "1h":
		query = `SELECT time_bucket('1 hour', bucket) AS time, avg(value) AS value
		          FROM metrics_5m
		          WHERE server_id = $1 AND metric_type = $2 AND metric_name = $3
		          AND bucket BETWEEN $4 AND $5
		          GROUP BY 1 ORDER BY 1`
	default:
		query = `SELECT time, value FROM metrics_raw
		          WHERE server_id = $1 AND metric_type = $2 AND metric_name = $3
		          AND time BETWEEN $4 AND $5 ORDER BY time`
	}

	rows, err := db.Pool.Query(ctx, query, p.ServerID, p.MetricType, p.MetricName, p.Start, p.End)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var points []MetricPoint
	for rows.Next() {
		var pt MetricPoint
		if err := rows.Scan(&pt.Time, &pt.Value); err != nil {
			return nil, err
		}
		points = append(points, pt)
	}
	return points, rows.Err()
}

func (db *DB) GetLatestMetrics(ctx context.Context, serverID string) ([]MetricRow, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT DISTINCT ON (metric_type, metric_name) metric_type, metric_name, value
		FROM metrics_raw
		WHERE server_id = $1 AND time > NOW() - INTERVAL '2 minutes'
		ORDER BY metric_type, metric_name, time DESC
	`, serverID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []MetricRow
	for rows.Next() {
		var r MetricRow
		if err := rows.Scan(&r.Type, &r.Name, &r.Value); err != nil {
			return nil, err
		}
		result = append(result, r)
	}
	return result, rows.Err()
}

// GetAllServersLatestMetrics returns the latest cpu/ram/disk value for every server in one query.
// Returns a map of serverID -> metric_type -> value.
func (db *DB) GetAllServersLatestMetrics(ctx context.Context) (map[string]map[string]float64, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT DISTINCT ON (server_id, metric_type) server_id::text, metric_type, value
		FROM metrics_raw
		WHERE metric_type IN ('cpu', 'ram', 'disk')
		  AND (
		    (metric_type = 'cpu'  AND metric_name = 'total') OR
		    (metric_type = 'ram'  AND metric_name = 'used_percent') OR
		    (metric_type = 'disk' AND metric_name = 'used_percent')
		  )
		  AND time > NOW() - INTERVAL '1 minute'
		ORDER BY server_id, metric_type, time DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := map[string]map[string]float64{}
	for rows.Next() {
		var serverID, metricType string
		var value float64
		if err := rows.Scan(&serverID, &metricType, &value); err != nil {
			return nil, err
		}
		if result[serverID] == nil {
			result[serverID] = map[string]float64{}
		}
		result[serverID][metricType] = value
	}
	return result, rows.Err()
}
