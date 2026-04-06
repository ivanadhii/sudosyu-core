# Sudosyu Core

Backend + frontend monitoring dashboard. Built with Go, Next.js, and TimescaleDB.

## Stack

- **Backend** — Go, chi router, pgx
- **Frontend** — Next.js 15, Tailwind CSS
- **Database** — TimescaleDB (PostgreSQL + time-series extension)

## Requirements

- Docker & Docker Compose
- Port `8080` (backend) and `3000` (frontend) available on the host

## Deploy

### 1. Clone

```bash
git clone https://github.com/ivanadhii/sudosyu-core.git
cd sudosyu-core
```

### 2. Configure environment

Create a `.env` file in the root (same directory as `docker-compose.yml`):

```env
DB_PASSWORD=ganti_password_aman
JWT_SECRET=ganti_secret_panjang_random
```

> Jika tidak dibuat, default fallback dipakai (`sudosyu_secret` / `change-me-in-production`). **Jangan pakai default di production.**

### 3. Jalankan

```bash
docker compose up -d
```

Pertama kali build akan memakan waktu beberapa menit. Setelah itu:

- Frontend: `http://<server-ip>:3000`
- Backend API: `http://<server-ip>:8080`

### 4. Update

```bash
git pull
docker compose up --build -d
```

---

## Akun Default

Login pertama kali buat akun lewat endpoint superadmin atau hubungi admin yang setup awal.

---

## Manajemen API Key

Ada dua jenis API key:

| Tipe | Keterangan |
|---|---|
| **Per-server key** | Satu key untuk satu server. Dibuat di Settings → Servers. |
| **Super key** | Satu key untuk semua server. Server auto-register berdasarkan `server_name` dari agent. Dibuat di Settings → Super Keys. |

> Super key cocok untuk deployment 10+ server agar tidak perlu register satu-satu.

---

## Alert

Alert dikonfigurasi per-server di tab **Alerts**. Jenis alert:

- **CPU / RAM / Disk** — threshold % selama durasi tertentu
- **Unreachable** — server tidak kirim data melebihi timeout (detik)
- **Container state** — perubahan status container (running → exited, dll)
- **Container redeploy** — container ID berubah (deploy baru terdeteksi)

Notifikasi dikirim via **Discord webhook**.

---

## Struktur

```
core/
├── backend/        # Go API server
│   ├── api/        # HTTP handlers, middleware, router
│   ├── alerting/   # Alert engine (polling + webhook)
│   ├── storage/    # Database layer (migrations, queries)
│   └── cmd/        # Entrypoint
├── frontend/       # Next.js dashboard
└── docker-compose.yml
```
