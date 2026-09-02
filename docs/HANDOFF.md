# Smart Shade — Handoff

> Paste this into a new Claude conversation to pick up where the previous session left off.
> Last updated: 2026-09-02

## What this project is

A full-stack, multi-tenant facilities platform built as a final CS project at HIT
(Holon Institute of Technology). It does two things on one stack:

1. **Real-time automation** — controls campus window shades from live weather via a
   weighted scoring algorithm (60% temperature, 40% light), pushed over WebSocket.
2. **Field maintenance management** — missions with subtask checklists, an approved
   knowledge base, equipment tracking, and reporting.

Ships as a responsive web app (managers) and an installable Android APK via Capacitor
(field workers), in English and Hebrew with RTL.

**Repo:** `github.com/Tomer98/My-Shade-Project` (public, branch `main`)

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, Vite (Rolldown), Socket.io client, Recharts, Axios |
| Mobile | Capacitor 8 (Android) + native Camera/Geolocation plugins |
| Backend | Node.js, Express 5, Socket.io, node-cron, JWT, bcrypt, Multer, Nodemailer |
| Database | MySQL 8 (mysql2 pool), 13 tables, versioned SQL migrations |
| Cloud | AWS EC2 + S3, Vercel (frontend), Cloudflare Tunnel (HTTPS) |
| Testing | Jest + Supertest (89 server), Vitest (12 client) |

## Current deployment (live)

| Thing | Value |
|---|---|
| Frontend | `https://my-shade-project.vercel.app` |
| Backend (tunnel) | `https://comm-angeles-parallel-gym.trycloudflare.com` |
| EC2 | `54.226.98.125` — Amazon Linux 2023, user `ec2-user` |
| SSH key | `C:\Users\bar_t\aws-keys\smart-shade-key.pem` |
| Login | `Tom` / `password123` |
| S3 bucket | `smart-shade-uploads` (us-east-1) |
| AWS CLI profile | `smartshade` (S3-only IAM user, least privilege) |

**Architecture note:** RDS was deleted; MySQL now runs as a container on the EC2 box
via the dev `docker-compose.yml`. `docker-compose.prod.yml` still expects external RDS
and is *not* what's running.

**Fragile bit:** the Cloudflare quick tunnel gets a **random URL on every restart**. It
runs as a systemd service (`shade-tunnel`) with `Restart=always`. If it restarts, the
Vercel env vars `VITE_API_URL` (with `/api`) and `VITE_SOCKET_URL` (without) must be
updated and the frontend redeployed.

## Key design decisions (and why)

- **Multi-tenancy enforced in SQL, not UI.** `companyId` travels in the signed JWT and
  scopes every query. Filtering in React would be display, not security.
- **Approval status checked *after* password.** Checking first would leak which accounts
  exist. There's a test pinning this.
- **Failed mission does not reschedule.** A stuck motor needs a human decision, not a
  visit booked 30 days out. All-done completes *and* spawns the next occurrence.
- **Failed subtask auto-opens a service ticket** carrying room, timestamp, mission and
  the worker's explanation. A worker on a ladder won't fill a second form.
- **Close Day halves `frequency_days`** — the spec's "moved to next day with higher
  frequency".
- **Capacitor over React Native.** The spec wants both a mobile app and a Windows
  management UI; one codebase serves both. RN was 2–4 weeks and would still need a
  separate desktop client.
- **MySQL kept over Postgres.** The One-Pager says Postgres but the project deck says
  MySQL — the source documents contradict. Migrating touched every query for no
  functional gain.
- **`schema.sql` + numbered migrations, both.** `schema.sql` starts with
  `DROP DATABASE` and only runs on a fresh Docker volume; migrations update existing
  databases safely. Two different operations, two files.
- **Decision engine is a pure function** (`services/decisionEngine.js`) so it's testable
  without HTTP or a database — 19 unit tests.
- **Storage service is provider-agnostic** — set `STORAGE_ENDPOINT` and the same code
  targets R2/MinIO/Spaces instead of S3.

## Migrations

Run in order against any existing database:

```
server/database/migrations/001_missions_and_guides.sql
server/database/migrations/002_area_gps_coordinates.sql
server/database/migrations/003_companies_signup_equipment.sql
```

`schema.sql` is now complete for clean installs (verified by building a throwaway DB
from it alone).

## Useful commands

```bash
# Local stack
docker compose up -d
cd client && npm run dev            # http://localhost:5173

# Tests
cd server && npm test               # 89
cd client && npx vitest run         # 12

# Seed a full demo scenario (missions at every stage, pending signup,
# equipment in each state, rated guides)
docker compose exec server node scripts/seed_demo.js

# Check the live tunnel URL still matches Vercel
ssh -i /c/Users/bar_t/aws-keys/smart-shade-key.pem ec2-user@54.226.98.125 "grep -ohE 'https://[a-z0-9-]+\.trycloudflare\.com' ~/tunnel.log | head -1"

# Android APK
cd client && npm run android:apk    # needs .env.android with ABSOLUTE urls
```

## Scope vs. the original specification

The project was built against the HIT "MaintControl" specification. Measured:

- **4,021 lines** answer an explicit spec requirement
- **2,576 lines** go beyond it (automation engine, campus map, charts, simulation)
- **1,293 lines** of tests — the spec required none

≈52% of the code answers nothing the spec asked for. But note: §0.1 of the spec *does*
ask for a *"real-time measure of the control room"*, which the original team never
implemented — so the WebSocket layer closes a stated gap rather than adding a feature.

Every explicit requirement is now implemented **except** the Postgres choice above.

## Known gaps / next steps

1. **IAM Instance Role instead of AWS keys in `.env`** — the biggest security
   improvement available. Keys currently sit in `server/.env` at mode 600.
2. **Named Cloudflare tunnel** (needs a domain) for a stable URL.
3. **Frontend component tests** — only the staff-ranking logic is covered.
4. `.gitattributes` has JSDoc-style `/** */` comments which aren't valid syntax; it
   prints warnings on every git command. Cosmetic.
5. `server/.env` exists in two old commits (`0d468d4`, `a983ca6`). Those credentials
   were rotated; AWS keys were never committed. Purging history would need
   `git filter-repo`.

## Documents

- `docs/architecture-guide-he.html` — full system explanation in Hebrew, 16 chapters
- `docs/presentation-runbook-he.html` — presentation walkthrough, test sequence, Q&A
- `README.md` — features, API table (49 endpoints), schema, deployment
- `smart_shade_architecture.svg` — architecture diagram

## Immediate context

The project is being presented in the next couple of days. The live environment is up
for that. **Remember to stop the EC2 instance afterwards** (~$0.35/day).
