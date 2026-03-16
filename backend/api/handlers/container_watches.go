package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/sudosyu/core/backend/storage"
)

type ContainerWatchHandler struct {
	db *storage.DB
}

func NewContainerWatchHandler(db *storage.DB) *ContainerWatchHandler {
	return &ContainerWatchHandler{db: db}
}

func (h *ContainerWatchHandler) List(w http.ResponseWriter, r *http.Request) {
	serverID := chi.URLParam(r, "id")
	watches, err := h.db.GetContainerWatches(r.Context(), serverID)
	if err != nil {
		http.Error(w, "error", http.StatusInternalServerError)
		return
	}
	if watches == nil {
		watches = []storage.ContainerWatch{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(watches)
}

func (h *ContainerWatchHandler) Create(w http.ResponseWriter, r *http.Request) {
	serverID := chi.URLParam(r, "id")
	var req struct {
		ContainerNames []string `json:"containerNames"`
		WebhookURL     string   `json:"webhookUrl"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	if len(req.ContainerNames) == 0 || req.WebhookURL == "" {
		http.Error(w, "containerNames and webhookUrl required", http.StatusBadRequest)
		return
	}

	var created []storage.ContainerWatch
	for _, name := range req.ContainerNames {
		watch, err := h.db.CreateContainerWatch(r.Context(), serverID, name, req.WebhookURL)
		if err != nil {
			http.Error(w, "create error", http.StatusInternalServerError)
			return
		}
		created = append(created, *watch)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(created)
}

func (h *ContainerWatchHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "watchId")
	if err := h.db.DeleteContainerWatch(r.Context(), id); err != nil {
		http.Error(w, "delete error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
