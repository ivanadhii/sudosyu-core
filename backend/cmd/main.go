package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/sudosyu/core/backend/alerting"
	"github.com/sudosyu/core/backend/api"
	"github.com/sudosyu/core/backend/config"
	"github.com/sudosyu/core/backend/storage"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	cfg := config.Load()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Connect DB
	db, err := storage.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db connect: %v", err)
	}
	defer db.Close()

	// Run migrations
	if err := db.Migrate(ctx); err != nil {
		log.Fatalf("migrate: %v", err)
	}

	// Ensure default superadmin exists
	hash, err := bcrypt.GenerateFromPassword([]byte("admin"), bcrypt.DefaultCost)
	if err != nil {
		log.Fatalf("bcrypt: %v", err)
	}
	if err := db.EnsureSuperadmin(ctx, string(hash)); err != nil {
		log.Printf("warn: ensure superadmin: %v", err)
	}

	// Start alert engine
	alertEngine := alerting.New(db)
	go alertEngine.Run(ctx)

	// Start HTTP server
	router := api.NewRouter(db, cfg.JWTSecret)
	srv := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: router,
	}

	go func() {
		log.Printf("Sudosyu backend listening on :%s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server: %v", err)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	cancel()
	shutCtx, shutCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutCancel()
	if err := srv.Shutdown(shutCtx); err != nil {
		log.Printf("shutdown: %v", err)
	}
	log.Println("Sudosyu backend stopped.")
}
