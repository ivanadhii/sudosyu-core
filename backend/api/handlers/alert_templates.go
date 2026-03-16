package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/sudosyu/core/backend/api/middleware"
	"github.com/sudosyu/core/backend/storage"
)

type AlertTemplateHandler struct {
	db *storage.DB
}

func NewAlertTemplateHandler(db *storage.DB) *AlertTemplateHandler {
	return &AlertTemplateHandler{db: db}
}

func (h *AlertTemplateHandler) List(w http.ResponseWriter, r *http.Request) {
	templates, err := h.db.ListAlertTemplates(r.Context())
	if err != nil {
		http.Error(w, "error", http.StatusInternalServerError)
		return
	}
	if templates == nil {
		templates = []storage.AlertTemplate{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(templates)
}

func (h *AlertTemplateHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name  string `json:"name"`
		Rules []struct {
			Metric          string  `json:"metric"`
			Condition       string  `json:"condition"`
			Threshold       float64 `json:"threshold"`
			DurationSeconds int     `json:"durationSeconds"`
			WebhookURL      string  `json:"webhookUrl"`
		} `json:"rules"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	rules := make([]storage.AlertTemplateRule, len(req.Rules))
	for i, r := range req.Rules {
		rules[i] = storage.AlertTemplateRule{
			Metric:          r.Metric,
			Condition:       r.Condition,
			Threshold:       r.Threshold,
			DurationSeconds: r.DurationSeconds,
			WebhookURL:      r.WebhookURL,
		}
	}

	t, err := h.db.CreateAlertTemplate(r.Context(), req.Name, rules)
	if err != nil {
		http.Error(w, "error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(t)
}

func (h *AlertTemplateHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.db.DeleteAlertTemplate(r.Context(), id); err != nil {
		http.Error(w, "error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *AlertTemplateHandler) Apply(w http.ResponseWriter, r *http.Request) {
	serverID := chi.URLParam(r, "id")

	// Access check
	sh := &ServersHandler{db: h.db}
	if !sh.canAccessServer(r, serverID) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	// Only coordinator+ can create alerts
	role := middleware.GetUserRole(r)
	if role == "watcher" {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	var req struct {
		TemplateID string `json:"templateId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.TemplateID == "" {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	if err := h.db.ApplyAlertTemplate(r.Context(), req.TemplateID, serverID); err != nil {
		http.Error(w, "error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
