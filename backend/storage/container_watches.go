package storage

import (
	"context"
	"fmt"
)

// watchScan is used for single-table queries (insert/update returning); no server name join.
const watchScan = `id, server_id, container_name, webhook_url,
	COALESCE(last_status, ''), COALESCE(last_container_id, ''), created_at`

func scanWatch(row interface {
	Scan(...any) error
}) (ContainerWatch, error) {
	var w ContainerWatch
	err := row.Scan(&w.ID, &w.ServerID, &w.ContainerName, &w.WebhookURL,
		&w.LastStatus, &w.LastContainerID, &w.CreatedAt)
	return w, err
}

func scanWatchWithName(row interface {
	Scan(...any) error
}) (ContainerWatch, error) {
	var w ContainerWatch
	err := row.Scan(&w.ID, &w.ServerID, &w.ServerName, &w.ContainerName, &w.WebhookURL,
		&w.LastStatus, &w.LastContainerID, &w.CreatedAt)
	return w, err
}

func (db *DB) GetContainerWatches(ctx context.Context, serverID string) ([]ContainerWatch, error) {
	rows, err := db.Pool.Query(ctx,
		`SELECT cw.id, cw.server_id, s.name, cw.container_name, cw.webhook_url,
		        COALESCE(cw.last_status, ''), COALESCE(cw.last_container_id, ''), cw.created_at
		 FROM container_watches cw JOIN servers s ON s.id = cw.server_id
		 WHERE cw.server_id = $1 ORDER BY cw.container_name`,
		serverID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var watches []ContainerWatch
	for rows.Next() {
		w, err := scanWatchWithName(rows)
		if err != nil {
			return nil, err
		}
		watches = append(watches, w)
	}
	return watches, rows.Err()
}

func (db *DB) GetAllContainerWatches(ctx context.Context) ([]ContainerWatch, error) {
	rows, err := db.Pool.Query(ctx,
		`SELECT cw.id, cw.server_id, s.name, cw.container_name, cw.webhook_url,
		        COALESCE(cw.last_status, ''), COALESCE(cw.last_container_id, ''), cw.created_at
		 FROM container_watches cw JOIN servers s ON s.id = cw.server_id
		 ORDER BY s.name, cw.container_name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var watches []ContainerWatch
	for rows.Next() {
		w, err := scanWatchWithName(rows)
		if err != nil {
			return nil, err
		}
		watches = append(watches, w)
	}
	return watches, rows.Err()
}

func (db *DB) CreateContainerWatch(ctx context.Context, serverID, containerName, webhookURL string) (*ContainerWatch, error) {
	row := db.Pool.QueryRow(ctx,
		`INSERT INTO container_watches (server_id, container_name, webhook_url)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (server_id, container_name) DO UPDATE SET webhook_url = EXCLUDED.webhook_url
		 RETURNING `+watchScan,
		serverID, containerName, webhookURL)
	w, err := scanWatch(row)
	if err != nil {
		return nil, fmt.Errorf("create container watch: %w", err)
	}
	return &w, nil
}

func (db *DB) DeleteContainerWatch(ctx context.Context, id string) error {
	_, err := db.Pool.Exec(ctx, `DELETE FROM container_watches WHERE id = $1`, id)
	return err
}

func (db *DB) UpdateContainerWatchState(ctx context.Context, id, status, containerID string) error {
	_, err := db.Pool.Exec(ctx,
		`UPDATE container_watches SET last_status = $2, last_container_id = $3 WHERE id = $1`,
		id, status, containerID)
	return err
}

// GetLatestContainerByName returns the most recent status and container_id for a named container.
func (db *DB) GetLatestContainerByName(ctx context.Context, serverID, name string) (status, containerID string, found bool) {
	err := db.Pool.QueryRow(ctx,
		`SELECT status, container_id FROM container_snapshots
		 WHERE server_id = $1 AND name = $2 AND time > NOW() - INTERVAL '2 minutes'
		 ORDER BY time DESC LIMIT 1`,
		serverID, name).Scan(&status, &containerID)
	if err != nil {
		return "", "", false
	}
	return status, containerID, true
}
