package storage

import (
	"context"
	"fmt"
	"time"
)

func (db *DB) GetServers(ctx context.Context) ([]Server, error) {
	rows, err := db.Pool.Query(ctx,
		`SELECT id, name, tags, created_at, last_seen_at FROM servers ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var servers []Server
	for rows.Next() {
		var s Server
		if err := rows.Scan(&s.ID, &s.Name, &s.Tags, &s.CreatedAt, &s.LastSeenAt); err != nil {
			return nil, err
		}
		servers = append(servers, s)
	}
	return servers, rows.Err()
}

func (db *DB) GetServersByIDs(ctx context.Context, ids []string) ([]Server, error) {
	rows, err := db.Pool.Query(ctx,
		`SELECT id, name, tags, created_at, last_seen_at FROM servers WHERE id = ANY($1) ORDER BY name`,
		ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var servers []Server
	for rows.Next() {
		var s Server
		if err := rows.Scan(&s.ID, &s.Name, &s.Tags, &s.CreatedAt, &s.LastSeenAt); err != nil {
			return nil, err
		}
		servers = append(servers, s)
	}
	return servers, rows.Err()
}

func (db *DB) GetServerByID(ctx context.Context, id string) (*Server, error) {
	var s Server
	err := db.Pool.QueryRow(ctx,
		`SELECT id, name, tags, created_at, last_seen_at FROM servers WHERE id = $1`, id).
		Scan(&s.ID, &s.Name, &s.Tags, &s.CreatedAt, &s.LastSeenAt)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (db *DB) GetServerByAPIKey(ctx context.Context, keyHash string) (*Server, error) {
	var s Server
	err := db.Pool.QueryRow(ctx,
		`SELECT id, name, tags, created_at, last_seen_at FROM servers WHERE api_key_hash = $1`, keyHash).
		Scan(&s.ID, &s.Name, &s.Tags, &s.CreatedAt, &s.LastSeenAt)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (db *DB) UpdateServerLastSeen(ctx context.Context, id string) error {
	_, err := db.Pool.Exec(ctx,
		`UPDATE servers SET last_seen_at = $1 WHERE id = $2`, time.Now(), id)
	return err
}

func (db *DB) CreateServer(ctx context.Context, name string, apiKeyHash string, tags []string) (*Server, error) {
	var s Server
	err := db.Pool.QueryRow(ctx,
		`INSERT INTO servers (name, api_key_hash, tags) VALUES ($1, $2, $3)
		 RETURNING id, name, tags, created_at, last_seen_at`,
		name, apiKeyHash, tags).
		Scan(&s.ID, &s.Name, &s.Tags, &s.CreatedAt, &s.LastSeenAt)
	if err != nil {
		return nil, fmt.Errorf("create server: %w", err)
	}
	return &s, nil
}

func (db *DB) DeleteServer(ctx context.Context, id string) error {
	_, err := db.Pool.Exec(ctx, `DELETE FROM servers WHERE id = $1`, id)
	return err
}

// GetOrCreateServerByName finds a server by name or creates it (used by super key agents).
func (db *DB) GetOrCreateServerByName(ctx context.Context, name string) (*Server, error) {
	var s Server
	err := db.Pool.QueryRow(ctx,
		`INSERT INTO servers (name, api_key_hash, tags)
		 VALUES ($1, '', '{}')
		 ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
		 RETURNING id, name, tags, created_at, last_seen_at`,
		name).
		Scan(&s.ID, &s.Name, &s.Tags, &s.CreatedAt, &s.LastSeenAt)
	if err != nil {
		return nil, fmt.Errorf("get or create server: %w", err)
	}
	return &s, nil
}
