package middleware

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"github.com/sudosyu/core/backend/storage"
)

type contextKey string

const (
	CtxUserID    contextKey = "userID"
	CtxUserRole  contextKey = "userRole"
	CtxServerID  contextKey = "serverID"
	CtxIsSuperKey contextKey = "isSuperKey"
)

type Claims struct {
	UserID   string `json:"userId"`
	Username string `json:"username"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

func JWTAuth(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			cookie, err := r.Cookie("sudosyu_token")
			if err != nil {
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}

			claims := &Claims{}
			token, err := jwt.ParseWithClaims(cookie.Value, claims, func(t *jwt.Token) (interface{}, error) {
				return []byte(secret), nil
			})
			if err != nil || !token.Valid {
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}

			ctx := context.WithValue(r.Context(), CtxUserID, claims.UserID)
			ctx = context.WithValue(ctx, CtxUserRole, claims.Role)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func APIKeyAuth(db *storage.DB) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			key := r.Header.Get("X-API-Key")
			if key == "" {
				http.Error(w, "missing api key", http.StatusUnauthorized)
				return
			}

			hash := hashAPIKey(key)

			// Try per-server key first
			server, err := db.GetServerByAPIKey(r.Context(), hash)
			if err == nil {
				ctx := context.WithValue(r.Context(), CtxServerID, server.ID)
				next.ServeHTTP(w, r.WithContext(ctx))
				return
			}

			// Try super key
			if db.IsSuperKey(r.Context(), hash) {
				ctx := context.WithValue(r.Context(), CtxIsSuperKey, true)
				next.ServeHTTP(w, r.WithContext(ctx))
				return
			}

			http.Error(w, "invalid api key", http.StatusUnauthorized)
		})
	}
}

func RequireRole(roles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			role, _ := r.Context().Value(CtxUserRole).(string)
			for _, allowed := range roles {
				if role == allowed {
					next.ServeHTTP(w, r)
					return
				}
			}
			http.Error(w, "forbidden", http.StatusForbidden)
		})
	}
}

func GetUserID(r *http.Request) string {
	v, _ := r.Context().Value(CtxUserID).(string)
	return v
}

func GetUserRole(r *http.Request) string {
	v, _ := r.Context().Value(CtxUserRole).(string)
	return v
}

func GetAgentServerID(r *http.Request) string {
	v, _ := r.Context().Value(CtxServerID).(string)
	return v
}

func IsAgentSuperKey(r *http.Request) bool {
	v, _ := r.Context().Value(CtxIsSuperKey).(bool)
	return v
}

func HashAPIKey(key string) string {
	return hashAPIKey(key)
}

func hashAPIKey(key string) string {
	h := sha256.Sum256([]byte(key))
	return hex.EncodeToString(h[:])
}

func CORSMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "http://localhost:3000")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-API-Key")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func contains(s []string, v string) bool {
	for _, x := range s {
		if strings.EqualFold(x, v) {
			return true
		}
	}
	return false
}
