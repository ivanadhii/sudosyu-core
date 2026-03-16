package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/sudosyu/core/backend/api/middleware"
	"github.com/sudosyu/core/backend/storage"
)

type SuperKeyHandler struct {
	db *storage.DB
}

func NewSuperKeyHandler(db *storage.DB) *SuperKeyHandler {
	return &SuperKeyHandler{db: db}
}

func (h *SuperKeyHandler) List(w http.ResponseWriter, r *http.Request) {
	keys, err := h.db.ListSuperKeys(r.Context())
	if err != nil {
		http.Error(w, "error", http.StatusInternalServerError)
		return
	}
	if keys == nil {
		keys = []storage.SuperAPIKey{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(keys)
}

func (h *SuperKeyHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name   string `json:"name"`
		APIKey string `json:"apiKey"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	if req.Name == "" || req.APIKey == "" {
		http.Error(w, "name and apiKey required", http.StatusBadRequest)
		return
	}

	keyHash := middleware.HashAPIKey(req.APIKey)
	key, err := h.db.CreateSuperKey(r.Context(), req.Name, keyHash)
	if err != nil {
		http.Error(w, "create error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(key)
}

func (h *SuperKeyHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.db.DeleteSuperKey(r.Context(), id); err != nil {
		http.Error(w, "delete error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
