package storage

import (
	"context"
	"fmt"
)

func (db *DB) GetUsers(ctx context.Context) ([]User, error) {
	rows, err := db.Pool.Query(ctx,
		`SELECT id, username, email, role, created_at, updated_at FROM users ORDER BY created_at`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []User
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.Username, &u.Email, &u.Role, &u.CreatedAt, &u.UpdatedAt); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, rows.Err()
}

func (db *DB) GetUserByUsername(ctx context.Context, username string) (*User, string, error) {
	var u User
	var hash string
	err := db.Pool.QueryRow(ctx,
		`SELECT id, username, email, role, password_hash, created_at, updated_at FROM users WHERE username = $1`,
		username).Scan(&u.ID, &u.Username, &u.Email, &u.Role, &hash, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, "", err
	}
	return &u, hash, nil
}

func (db *DB) GetUserByID(ctx context.Context, id string) (*User, error) {
	var u User
	err := db.Pool.QueryRow(ctx,
		`SELECT id, username, email, role, created_at, updated_at FROM users WHERE id = $1`, id).
		Scan(&u.ID, &u.Username, &u.Email, &u.Role, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (db *DB) CreateUser(ctx context.Context, username, email, passwordHash, role string) (*User, error) {
	var u User
	err := db.Pool.QueryRow(ctx, `
		INSERT INTO users (username, email, password_hash, role)
		VALUES ($1, $2, $3, $4)
		RETURNING id, username, email, role, created_at, updated_at`,
		username, email, passwordHash, role).
		Scan(&u.ID, &u.Username, &u.Email, &u.Role, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("create user: %w", err)
	}
	return &u, nil
}

func (db *DB) DeleteUser(ctx context.Context, id string) error {
	_, err := db.Pool.Exec(ctx, `DELETE FROM users WHERE id = $1`, id)
	return err
}

func (db *DB) GetUserAccess(ctx context.Context, userID string) ([]UserServerAccess, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT usa.user_id, usa.server_id, s.name, usa.permissions, usa.granted_by
		FROM user_server_access usa
		JOIN servers s ON s.id = usa.server_id
		WHERE usa.user_id = $1`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []UserServerAccess
	for rows.Next() {
		var a UserServerAccess
		if err := rows.Scan(&a.UserID, &a.ServerID, &a.ServerName, &a.Permissions, &a.GrantedBy); err != nil {
			return nil, err
		}
		result = append(result, a)
	}
	return result, rows.Err()
}

func (db *DB) GetUserServerIDs(ctx context.Context, userID string) ([]string, error) {
	rows, err := db.Pool.Query(ctx,
		`SELECT server_id FROM user_server_access WHERE user_id = $1`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

func (db *DB) SetUserAccess(ctx context.Context, userID, grantedBy string, access []UserServerAccess) error {
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `DELETE FROM user_server_access WHERE user_id = $1`, userID)
	if err != nil {
		return err
	}

	for _, a := range access {
		_, err = tx.Exec(ctx, `
			INSERT INTO user_server_access (user_id, server_id, permissions, granted_by)
			VALUES ($1, $2, $3, $4)`,
			userID, a.ServerID, a.Permissions, grantedBy)
		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

func (db *DB) HasServerAccess(ctx context.Context, userID, serverID string) (bool, []string, error) {
	var perms []string
	err := db.Pool.QueryRow(ctx,
		`SELECT permissions FROM user_server_access WHERE user_id = $1 AND server_id = $2`,
		userID, serverID).Scan(&perms)
	if err != nil {
		return false, nil, nil // no access
	}
	return true, perms, nil
}

func (db *DB) GetUserByIDWithHash(ctx context.Context, id string) (*User, string, error) {
	var u User
	var hash string
	err := db.Pool.QueryRow(ctx,
		`SELECT id, username, email, role, password_hash, created_at, updated_at FROM users WHERE id = $1`, id).
		Scan(&u.ID, &u.Username, &u.Email, &u.Role, &hash, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, "", err
	}
	return &u, hash, nil
}

func (db *DB) UpdatePassword(ctx context.Context, userID, newHash string) error {
	_, err := db.Pool.Exec(ctx,
		`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, newHash, userID)
	return err
}

func (db *DB) EnsureSuperadmin(ctx context.Context, passwordHash string) error {
	_, err := db.Pool.Exec(ctx, `
		INSERT INTO users (username, email, password_hash, role)
		VALUES ('admin', 'admin@sudosyu.local', $1, 'superadmin')
		ON CONFLICT (username) DO NOTHING`, passwordHash)
	return err
}
