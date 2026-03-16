package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/sudosyu/core/backend/api/middleware"
	"github.com/sudosyu/core/backend/storage"
)

type ServersHandler struct {
	db *storage.DB
}

func NewServersHandler(db *storage.DB) *ServersHandler {
	return &ServersHandler{db: db}
}

func (h *ServersHandler) List(w http.ResponseWriter, r *http.Request) {
	role := middleware.GetUserRole(r)
	userID := middleware.GetUserID(r)

	var servers []storage.Server
	var err error

	if role == "superadmin" {
		servers, err = h.db.GetServers(r.Context())
	} else {
		ids, e := h.db.GetUserServerIDs(r.Context(), userID)
		if e != nil {
			http.Error(w, "error", http.StatusInternalServerError)
			return
		}
		if len(ids) > 0 {
			servers, err = h.db.GetServersByIDs(r.Context(), ids)
		}
	}

	if err != nil {
		http.Error(w, "error", http.StatusInternalServerError)
		return
	}
	if servers == nil {
		servers = []storage.Server{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(servers)
}

func (h *ServersHandler) GetSummaries(w http.ResponseWriter, r *http.Request) {
	role := middleware.GetUserRole(r)
	userID := middleware.GetUserID(r)

	var servers []storage.Server
	var err error

	if role == "superadmin" {
		servers, err = h.db.GetServers(r.Context())
	} else {
		ids, e := h.db.GetUserServerIDs(r.Context(), userID)
		if e != nil {
			http.Error(w, "error", http.StatusInternalServerError)
			return
		}
		if len(ids) > 0 {
			servers, err = h.db.GetServersByIDs(r.Context(), ids)
		}
	}
	if err != nil {
		http.Error(w, "error", http.StatusInternalServerError)
		return
	}

	latestMetrics, _ := h.db.GetAllServersLatestMetrics(r.Context())

	type ServerSummary struct {
		ID          string     `json:"id"`
		Name        string     `json:"name"`
		Tags        []string   `json:"tags"`
		LastSeenAt  *string    `json:"lastSeenAt"`
		CPUPercent  *float64   `json:"cpuPercent"`
		RAMPercent  *float64   `json:"ramPercent"`
		DiskPercent *float64   `json:"diskPercent"`
	}

	summaries := make([]ServerSummary, 0, len(servers))
	for _, s := range servers {
		sum := ServerSummary{
			ID:   s.ID,
			Name: s.Name,
			Tags: s.Tags,
		}
		if s.LastSeenAt != nil {
			t := s.LastSeenAt.Format("2006-01-02T15:04:05Z07:00")
			sum.LastSeenAt = &t
		}
		if m, ok := latestMetrics[s.ID]; ok {
			if v, ok := m["cpu"]; ok { sum.CPUPercent = &v }
			if v, ok := m["ram"]; ok { sum.RAMPercent = &v }
			if v, ok := m["disk"]; ok { sum.DiskPercent = &v }
		}
		summaries = append(summaries, sum)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(summaries)
}

func (h *ServersHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if !h.canAccessServer(r, id) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	server, err := h.db.GetServerByID(r.Context(), id)
	if err != nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(server)
}

func (h *ServersHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name   string   `json:"name"`
		APIKey string   `json:"apiKey"`
		Tags   []string `json:"tags"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	if req.APIKey == "" || req.Name == "" {
		http.Error(w, "name and apiKey required", http.StatusBadRequest)
		return
	}

	keyHash := middleware.HashAPIKey(req.APIKey)
	server, err := h.db.CreateServer(r.Context(), req.Name, keyHash, req.Tags)
	if err != nil {
		http.Error(w, "create error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(server)
}

func (h *ServersHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.db.DeleteServer(r.Context(), id); err != nil {
		http.Error(w, "delete error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *ServersHandler) GetContainers(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if !h.canAccessServer(r, id) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	containers, err := h.db.GetLatestContainers(r.Context(), id)
	if err != nil {
		http.Error(w, "error", http.StatusInternalServerError)
		return
	}
	if containers == nil {
		containers = []storage.ContainerSnapshot{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(containers)
}

func (h *ServersHandler) GetDockerDF(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if !h.canAccessServer(r, id) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	df, err := h.db.GetLatestDockerDF(r.Context(), id)
	if err != nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(df)
}

func (h *ServersHandler) GetLatest(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if !h.canAccessServer(r, id) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	type LatestSummary struct {
		CPUPercent        *float64 `json:"cpuPercent"`
		RAMPercent        *float64 `json:"ramPercent"`
		DiskPercent       *float64 `json:"diskPercent"`
		ContainersRunning int      `json:"containersRunning"`
	}

	metrics, err := h.db.GetLatestMetrics(r.Context(), id)
	containers, _ := h.db.GetLatestContainers(r.Context(), id)

	summary := LatestSummary{}

	if err == nil {
		for _, m := range metrics {
			val := m.Value
			switch {
			case m.Type == "cpu" && m.Name == "total":
				summary.CPUPercent = &val
			case m.Type == "ram" && m.Name == "used_percent":
				summary.RAMPercent = &val
			case m.Type == "disk" && m.Name == "used_percent":
				summary.DiskPercent = &val
			}
		}
	}

	for _, c := range containers {
		if c.Status == "running" {
			summary.ContainersRunning++
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(summary)
}

func (h *ServersHandler) canAccessServer(r *http.Request, serverID string) bool {
	role := middleware.GetUserRole(r)
	if role == "superadmin" {
		return true
	}
	userID := middleware.GetUserID(r)
	ok, _, _ := h.db.HasServerAccess(r.Context(), userID, serverID)
	return ok
}
