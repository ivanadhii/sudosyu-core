package handlers

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/sudosyu/core/backend/api/middleware"
	"github.com/sudosyu/core/backend/storage"
)

var wib = func() *time.Location {
	if loc, err := time.LoadLocation("Asia/Jakarta"); err == nil {
		return loc
	}
	return time.FixedZone("WIB", 7*60*60)
}()

type ExportHandler struct {
	db *storage.DB
}

func NewExportHandler(db *storage.DB) *ExportHandler {
	return &ExportHandler{db: db}
}

func (h *ExportHandler) Export(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	serverID := q.Get("server_id")
	metricType := q.Get("metric")
	metricName := q.Get("name")
	resolution := q.Get("resolution")
	format := q.Get("format")

	// Access check
	role := middleware.GetUserRole(r)
	userID := middleware.GetUserID(r)
	if role != "superadmin" {
		ok, _, _ := h.db.HasServerAccess(r.Context(), userID, serverID)
		if !ok {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
	}

	start, _ := time.Parse(time.RFC3339, q.Get("start"))
	end, _ := time.Parse(time.RFC3339, q.Get("end"))
	if start.IsZero() {
		start = time.Now().Add(-24 * time.Hour)
	}
	if end.IsZero() {
		end = time.Now()
	}

	points, err := h.db.QueryMetrics(r.Context(), storage.QueryMetricsParams{
		ServerID:   serverID,
		MetricType: metricType,
		MetricName: metricName,
		Start:      start,
		End:        end,
		Resolution: resolution,
	})
	if err != nil {
		http.Error(w, "query error", http.StatusInternalServerError)
		return
	}

	filename := fmt.Sprintf("sudosyu_%s_%s_%s.%s", serverID, metricType, time.Now().Format("20060102"), format)

	// Convert timestamps to WIB for export
	for i := range points {
		points[i].Time = points[i].Time.In(wib)
	}

	switch format {
	case "json":
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
		json.NewEncoder(w).Encode(points)
	default: // csv
		w.Header().Set("Content-Type", "text/csv")
		w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
		cw := csv.NewWriter(w)
		_ = cw.Write([]string{"time", "value"})
		for _, p := range points {
			_ = cw.Write([]string{p.Time.In(wib).Format(time.RFC3339), fmt.Sprintf("%.4f", p.Value)})
		}
		cw.Flush()
	}
}
