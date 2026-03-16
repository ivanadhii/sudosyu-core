package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/sudosyu/core/backend/api/middleware"
	"github.com/sudosyu/core/backend/storage"
	"golang.org/x/crypto/bcrypt"
)

type UsersHandler struct {
	db *storage.DB
}

func NewUsersHandler(db *storage.DB) *UsersHandler {
	return &UsersHandler{db: db}
}

func (h *UsersHandler) List(w http.ResponseWriter, r *http.Request) {
	users, err := h.db.GetUsers(r.Context())
	if err != nil {
		http.Error(w, "error", http.StatusInternalServerError)
		return
	}
	if users == nil {
		users = []storage.User{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}

func (h *UsersHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Username string `json:"username"`
		Email    string `json:"email"`
		Password string `json:"password"`
		Role     string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	if req.Role == "superadmin" {
		http.Error(w, "cannot create superadmin via API", http.StatusForbidden)
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	user, err := h.db.CreateUser(r.Context(), req.Username, req.Email, string(hash), req.Role)
	if err != nil {
		http.Error(w, "create error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(user)
}

func (h *UsersHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	callerID := middleware.GetUserID(r)
	if id == callerID {
		http.Error(w, "cannot delete yourself", http.StatusBadRequest)
		return
	}
	if err := h.db.DeleteUser(r.Context(), id); err != nil {
		http.Error(w, "error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *UsersHandler) GetAccess(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	callerRole := middleware.GetUserRole(r)
	callerID := middleware.GetUserID(r)

	// Coordinators can only view their own access or access they've granted
	if callerRole == "coordinator" && id != callerID {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	access, err := h.db.GetUserAccess(r.Context(), id)
	if err != nil {
		http.Error(w, "error", http.StatusInternalServerError)
		return
	}
	if access == nil {
		access = []storage.UserServerAccess{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(access)
}

func (h *UsersHandler) SetAccess(w http.ResponseWriter, r *http.Request) {
	targetUserID := chi.URLParam(r, "id")
	callerID := middleware.GetUserID(r)
	callerRole := middleware.GetUserRole(r)

	var req struct {
		Access []storage.UserServerAccess `json:"access"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	// Coordinators can only assign servers within their own scope
	if callerRole == "coordinator" {
		callerServerIDs, err := h.db.GetUserServerIDs(r.Context(), callerID)
		if err != nil {
			http.Error(w, "error", http.StatusInternalServerError)
			return
		}
		callerSet := make(map[string]bool)
		for _, id := range callerServerIDs {
			callerSet[id] = true
		}
		for _, a := range req.Access {
			if !callerSet[a.ServerID] {
				http.Error(w, "cannot assign servers outside your scope", http.StatusForbidden)
				return
			}
		}
	}

	if err := h.db.SetUserAccess(r.Context(), targetUserID, callerID, req.Access); err != nil {
		http.Error(w, "error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
