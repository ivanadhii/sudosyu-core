package storage

import (
	"context"
	"fmt"
)

func (db *DB) IsSuperKey(ctx context.Context, keyHash string) bool {
	var exists bool
	db.Pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM super_api_keys WHERE key_hash = $1)`, keyHash).
		Scan(&exists)
	return exists
}

func (db *DB) CreateSuperKey(ctx context.Context, name, keyHash string) (*SuperAPIKey, error) {
	var k SuperAPIKey
	err := db.Pool.QueryRow(ctx,
		`INSERT INTO super_api_keys (name, key_hash) VALUES ($1, $2) RETURNING id, name, created_at`,
		name, keyHash).
		Scan(&k.ID, &k.Name, &k.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("create super key: %w", err)
	}
	return &k, nil
}

func (db *DB) ListSuperKeys(ctx context.Context) ([]SuperAPIKey, error) {
	rows, err := db.Pool.Query(ctx,
		`SELECT id, name, created_at FROM super_api_keys ORDER BY created_at`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var keys []SuperAPIKey
	for rows.Next() {
		var k SuperAPIKey
		if err := rows.Scan(&k.ID, &k.Name, &k.CreatedAt); err != nil {
			return nil, err
		}
		keys = append(keys, k)
	}
	return keys, rows.Err()
}

func (db *DB) DeleteSuperKey(ctx context.Context, id string) error {
	_, err := db.Pool.Exec(ctx, `DELETE FROM super_api_keys WHERE id = $1`, id)
	return err
}
