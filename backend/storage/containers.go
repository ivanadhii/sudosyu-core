package storage

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
)

func (db *DB) IngestContainerSnapshot(ctx context.Context, serverID string, containers []ContainerSnapshot) error {
	if len(containers) == 0 {
		return nil
	}
	now := time.Now()
	batch := &pgx.Batch{}
	for _, c := range containers {
		batch.Queue(`
			INSERT INTO container_snapshots
			(time, server_id, container_id, name, image, status, uptime, restart_count, ports,
			 cpu_percent, mem_mb, mem_percent, net_in, net_out, block_read, block_write)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
			now, serverID, c.ContainerID, c.Name, c.Image, c.Status, c.Uptime,
			c.RestartCount, c.Ports, c.CPUPercent, c.MemMB, c.MemPercent,
			c.NetIn, c.NetOut, c.BlockRead, c.BlockWrite,
		)
	}
	br := db.Pool.SendBatch(ctx, batch)
	defer br.Close()
	for range containers {
		if _, err := br.Exec(); err != nil {
			return err
		}
	}
	return nil
}

func (db *DB) GetLatestContainers(ctx context.Context, serverID string) ([]ContainerSnapshot, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT DISTINCT ON (container_id)
		  time, container_id, name, image, status, uptime, restart_count, ports,
		  cpu_percent, mem_mb, mem_percent, net_in, net_out, block_read, block_write
		FROM container_snapshots
		WHERE server_id = $1 AND time > NOW() - INTERVAL '2 minutes'
		ORDER BY container_id, time DESC
	`, serverID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []ContainerSnapshot
	for rows.Next() {
		var c ContainerSnapshot
		if err := rows.Scan(
			&c.Time, &c.ContainerID, &c.Name, &c.Image, &c.Status, &c.Uptime,
			&c.RestartCount, &c.Ports, &c.CPUPercent, &c.MemMB, &c.MemPercent,
			&c.NetIn, &c.NetOut, &c.BlockRead, &c.BlockWrite,
		); err != nil {
			return nil, err
		}
		result = append(result, c)
	}
	return result, rows.Err()
}

func (db *DB) IngestDockerDF(ctx context.Context, serverID string, df DockerDFSnapshot) error {
	_, err := db.Pool.Exec(ctx, `
		INSERT INTO docker_df_snapshots
		(time, server_id, images_size, images_reclaimable, containers_size,
		 volumes_size, volumes_reclaimable, build_cache_size, build_cache_reclaimable)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
		time.Now(), serverID, df.ImagesSize, df.ImagesReclaimable, df.ContainersSize,
		df.VolumesSize, df.VolumesReclaimable, df.BuildCacheSize, df.BuildCacheReclaimable,
	)
	return err
}

func (db *DB) GetLatestDockerDF(ctx context.Context, serverID string) (*DockerDFSnapshot, error) {
	var df DockerDFSnapshot
	err := db.Pool.QueryRow(ctx, `
		SELECT time, images_size, images_reclaimable, containers_size,
		       volumes_size, volumes_reclaimable, build_cache_size, build_cache_reclaimable
		FROM docker_df_snapshots
		WHERE server_id = $1
		ORDER BY time DESC LIMIT 1
	`, serverID).Scan(
		&df.Time, &df.ImagesSize, &df.ImagesReclaimable, &df.ContainersSize,
		&df.VolumesSize, &df.VolumesReclaimable, &df.BuildCacheSize, &df.BuildCacheReclaimable,
	)
	if err != nil {
		return nil, err
	}
	return &df, nil
}
