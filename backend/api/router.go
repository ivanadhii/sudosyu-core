package api

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	chiMiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/sudosyu/core/backend/api/handlers"
	mw "github.com/sudosyu/core/backend/api/middleware"
	"github.com/sudosyu/core/backend/storage"
)

func NewRouter(db *storage.DB, jwtSecret string) http.Handler {
	r := chi.NewRouter()

	r.Use(chiMiddleware.Logger)
	r.Use(chiMiddleware.Recoverer)
	r.Use(mw.CORSMiddleware)

	authH := handlers.NewAuthHandler(db, jwtSecret)
	serversH := handlers.NewServersHandler(db)
	metricsH := handlers.NewMetricsHandler(db)
	alertsH := handlers.NewAlertsHandler(db)
	usersH := handlers.NewUsersHandler(db)
	exportH := handlers.NewExportHandler(db)
	superKeyH := handlers.NewSuperKeyHandler(db)
	containerWatchH := handlers.NewContainerWatchHandler(db)
	alertTemplateH := handlers.NewAlertTemplateHandler(db)

	r.Route("/api/v1", func(r chi.Router) {
		// Auth (public)
		r.Post("/auth/login", authH.Login)
		r.Post("/auth/logout", authH.Logout)

		// Agent ingestion (API key auth)
		r.Group(func(r chi.Router) {
			r.Use(mw.APIKeyAuth(db))
			r.Post("/metrics", metricsH.Ingest)
		})

		// Dashboard (JWT auth)
		r.Group(func(r chi.Router) {
			r.Use(mw.JWTAuth(jwtSecret))

			r.Get("/auth/me", authH.Me)
			r.Post("/auth/change-password", authH.ChangePassword)

			// Servers
			r.Get("/servers", serversH.List)
			r.Get("/servers/summaries", serversH.GetSummaries)
			r.Get("/servers/{id}", serversH.Get)
			r.Get("/servers/{id}/metrics", metricsH.QueryMetrics)
			r.Get("/servers/{id}/containers", serversH.GetContainers)
			r.Get("/servers/{id}/docker-df", serversH.GetDockerDF)
			r.Get("/servers/{id}/latest", serversH.GetLatest)
			r.Get("/servers/{id}/container-watches", containerWatchH.List)
			r.Post("/servers/{id}/container-watches", containerWatchH.Create)
			r.Delete("/servers/{id}/container-watches/{watchId}", containerWatchH.Delete)

			// Superadmin only: server management
			r.Group(func(r chi.Router) {
				r.Use(mw.RequireRole("superadmin"))
				r.Post("/servers", serversH.Create)
				r.Delete("/servers/{id}", serversH.Delete)
			})

			// Alerts
			r.Get("/alerts", alertsH.List)
			r.Post("/alerts", alertsH.Create)
			r.Delete("/alerts/{id}", alertsH.Delete)

			// Alert templates
			r.Get("/alert-templates", alertTemplateH.List)
			r.Post("/alert-templates", alertTemplateH.Create)
			r.Delete("/alert-templates/{id}", alertTemplateH.Delete)
			r.Post("/servers/{id}/apply-template", alertTemplateH.Apply)

			// Export
			r.Get("/export", exportH.Export)

			// Users (superadmin + coordinator for access mgmt)
			r.Get("/users/{id}/access", usersH.GetAccess)
			r.Put("/users/{id}/access", usersH.SetAccess)

			r.Group(func(r chi.Router) {
				r.Use(mw.RequireRole("superadmin"))
				r.Get("/users", usersH.List)
				r.Post("/users", usersH.Create)
				r.Delete("/users/{id}", usersH.Delete)

				// Super API keys
				r.Get("/super-keys", superKeyH.List)
				r.Post("/super-keys", superKeyH.Create)
				r.Delete("/super-keys/{id}", superKeyH.Delete)
			})
		})
	})

	return r
}
