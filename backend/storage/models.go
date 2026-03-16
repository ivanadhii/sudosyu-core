package storage

import "time"

type Server struct {
	ID          string     `json:"id"`
	Name        string     `json:"name"`
	Tags        []string   `json:"tags"`
	CreatedAt   time.Time  `json:"createdAt"`
	LastSeenAt  *time.Time `json:"lastSeenAt"`
}

type User struct {
	ID        string    `json:"id"`
	Username  string    `json:"username"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type UserServerAccess struct {
	UserID      string   `json:"userId"`
	ServerID    string   `json:"serverId"`
	ServerName  string   `json:"serverName,omitempty"`
	Permissions []string `json:"permissions"`
	GrantedBy   string   `json:"grantedBy"`
}

type MetricPoint struct {
	Time  time.Time `json:"time"`
	Value float64   `json:"value"`
}

type MetricSeries struct {
	MetricType string        `json:"metricType"`
	MetricName string        `json:"metricName"`
	Points     []MetricPoint `json:"points"`
}

type ContainerSnapshot struct {
	Time         time.Time `json:"time"`
	ContainerID  string    `json:"containerId"`
	Name         string    `json:"name"`
	Image        string    `json:"image"`
	Status       string    `json:"status"`
	Uptime       string    `json:"uptime"`
	RestartCount int       `json:"restartCount"`
	Ports        []string  `json:"ports"`
	CPUPercent   *float64  `json:"cpuPercent"`
	MemMB        *float64  `json:"memMB"`
	MemPercent   *float64  `json:"memPercent"`
	NetIn        *float64  `json:"netIn"`
	NetOut       *float64  `json:"netOut"`
	BlockRead    *float64  `json:"blockRead"`
	BlockWrite   *float64  `json:"blockWrite"`
}

type DockerDFSnapshot struct {
	Time                  time.Time `json:"time"`
	ImagesSize            int64     `json:"imagesSize"`
	ImagesReclaimable     int64     `json:"imagesReclaimable"`
	ContainersSize        int64     `json:"containersSize"`
	VolumesSize           int64     `json:"volumesSize"`
	VolumesReclaimable    int64     `json:"volumesReclaimable"`
	BuildCacheSize        int64     `json:"buildCacheSize"`
	BuildCacheReclaimable int64     `json:"buildCacheReclaimable"`
}

type ContainerWatch struct {
	ID              string    `json:"id"`
	ServerID        string    `json:"serverId"`
	ServerName      string    `json:"serverName"`
	ContainerName   string    `json:"containerName"`
	WebhookURL      string    `json:"webhookUrl"`
	LastStatus      string    `json:"lastStatus"`
	LastContainerID string    `json:"lastContainerId"`
	CreatedAt       time.Time `json:"createdAt"`
}

type AlertTemplateRule struct {
	ID              string  `json:"id"`
	TemplateID      string  `json:"templateId"`
	Metric          string  `json:"metric"`
	Condition       string  `json:"condition"`
	Threshold       float64 `json:"threshold"`
	DurationSeconds int     `json:"durationSeconds"`
	WebhookURL      string  `json:"webhookUrl"`
}

type AlertTemplate struct {
	ID        string              `json:"id"`
	Name      string              `json:"name"`
	CreatedAt time.Time           `json:"createdAt"`
	Rules     []AlertTemplateRule `json:"rules"`
}

type SuperAPIKey struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"createdAt"`
}

type Alert struct {
	ID              string    `json:"id"`
	ServerID        string    `json:"serverId"`
	ServerName      string    `json:"serverName"`
	Metric          string    `json:"metric"`
	Condition       string    `json:"condition"`
	Threshold       float64   `json:"threshold"`
	DurationSeconds int       `json:"durationSeconds"`
	Channel         string    `json:"channel"`
	WebhookURL      string    `json:"webhookUrl"`
	Active          bool      `json:"active"`
	CreatedAt       time.Time `json:"createdAt"`
}
