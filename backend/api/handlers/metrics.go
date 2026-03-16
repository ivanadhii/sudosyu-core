package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/sudosyu/core/backend/api/middleware"
	"github.com/sudosyu/core/backend/storage"
)

type MetricsHandler struct {
	db *storage.DB
}

func NewMetricsHandler(db *storage.DB) *MetricsHandler {
	return &MetricsHandler{db: db}
}

// agentMetricsPayload is what the agent POSTs
type agentMetricsPayload struct {
	ServerName string                      `json:"serverName"`
	Timestamp  time.Time                   `json:"timestamp"`
	Metrics    []storage.MetricRow         `json:"metrics"`
	Containers []storage.ContainerSnapshot `json:"containers"`
	DockerDF   *storage.DockerDFSnapshot   `json:"dockerDf"`
}

func (h *MetricsHandler) Ingest(w http.ResponseWriter, r *http.Request) {
	var payload agentMetricsPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	var serverID string
	if middleware.IsAgentSuperKey(r) {
		if payload.ServerName == "" {
			http.Error(w, "serverName required when using super api key", http.StatusBadRequest)
			return
		}
		server, err := h.db.GetOrCreateServerByName(r.Context(), payload.ServerName)
		if err != nil {
			http.Error(w, "server error", http.StatusInternalServerError)
			return
		}
		serverID = server.ID
	} else {
		serverID = middleware.GetAgentServerID(r)
	}

	if payload.Timestamp.IsZero() {
		payload.Timestamp = time.Now()
	}

	if len(payload.Metrics) > 0 {
		if err := h.db.IngestMetrics(r.Context(), storage.IngestPayload{
			ServerID: serverID,
			Time:     payload.Timestamp,
			Metrics:  payload.Metrics,
		}); err != nil {
			http.Error(w, "ingest error", http.StatusInternalServerError)
			return
		}
	}

	if len(payload.Containers) > 0 {
		_ = h.db.IngestContainerSnapshot(r.Context(), serverID, payload.Containers)
	}

	if payload.DockerDF != nil {
		_ = h.db.IngestDockerDF(r.Context(), serverID, *payload.DockerDF)
	}

	_ = h.db.UpdateServerLastSeen(r.Context(), serverID)
	w.WriteHeader(http.StatusNoContent)
}

func (h *MetricsHandler) QueryMetrics(w http.ResponseWriter, r *http.Request) {
	serverID := chi.URLParam(r, "id")
	q := r.URL.Query()

	start, _ := time.Parse(time.RFC3339, q.Get("start"))
	end, _ := time.Parse(time.RFC3339, q.Get("end"))
	if start.IsZero() {
		start = time.Now().Add(-1 * time.Hour)
	}
	if end.IsZero() {
		end = time.Now()
	}

	points, err := h.db.QueryMetrics(r.Context(), storage.QueryMetricsParams{
		ServerID:   serverID,
		MetricType: q.Get("type"),
		MetricName: q.Get("name"),
		Start:      start,
		End:        end,
		Resolution: q.Get("resolution"),
	})
	if err != nil {
		http.Error(w, "query error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(points)
}
