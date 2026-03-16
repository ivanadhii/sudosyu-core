package storage

import (
	"context"
	_ "embed"
	"fmt"
	"strings"
)

//go:embed migrations/001_init.sql
var initSQL string

func (db *DB) Migrate(ctx context.Context) error {
	// Execute each statement individually — TimescaleDB continuous aggregates
	// and retention policies cannot run inside a transaction block.
	stmts := splitSQL(initSQL)
	for _, stmt := range stmts {
		stmt = strings.TrimSpace(stmt)
		if stmt == "" {
			continue
		}
		if _, err := db.Pool.Exec(ctx, stmt); err != nil {
			return fmt.Errorf("migrate: %w\nstatement: %s", err, stmt)
		}
	}
	return nil
}

// splitSQL splits SQL text on semicolons while ignoring those inside comments.
func splitSQL(sql string) []string {
	var stmts []string
	var buf strings.Builder
	for i := 0; i < len(sql); i++ {
		// Skip line comments
		if i+1 < len(sql) && sql[i] == '-' && sql[i+1] == '-' {
			for i < len(sql) && sql[i] != '\n' {
				i++
			}
			buf.WriteByte('\n')
			continue
		}
		if sql[i] == ';' {
			stmts = append(stmts, buf.String())
			buf.Reset()
		} else {
			buf.WriteByte(sql[i])
		}
	}
	if s := strings.TrimSpace(buf.String()); s != "" {
		stmts = append(stmts, s)
	}
	return stmts
}
