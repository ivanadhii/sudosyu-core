package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/sudosyu/core/backend/storage"
)

type AlertsHandler struct {
	db *storage.DB
}

func NewAlertsHandler(db *storage.DB) *AlertsHandler {
	return &AlertsHandler{db: db}
}

func (h *AlertsHandler) List(w http.ResponseWriter, r *http.Request) {
	serverID := r.URL.Query().Get("server_id")
	var alerts []storage.Alert
	var err error
	if serverID != "" {
		alerts, err = h.db.GetAlerts(r.Context(), serverID)
	} else {
		alerts, err = h.db.GetAllAlerts(r.Context())
	}
	if err != nil {
		http.Error(w, "error", http.StatusInternalServerError)
		return
	}
	if alerts == nil {
		alerts = []storage.Alert{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(alerts)
}

func (h *AlertsHandler) Create(w http.ResponseWriter, r *http.Request) {
	var a storage.Alert
	if err := json.NewDecoder(r.Body).Decode(&a); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	created, err := h.db.CreateAlert(r.Context(), a)
	if err != nil {
		http.Error(w, "create error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(created)
}

func (h *AlertsHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.db.DeleteAlert(r.Context(), id); err != nil {
		http.Error(w, "error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
