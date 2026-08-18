# LifeFlow

A private productivity hub for you and friends. Combines Google Calendar, Notes, Tasks, Telegram reminders, and local AI — all at **$0 operating cost**.

## Architecture

```
LifeFlow (Next.js) ──── PostgreSQL (Docker)
       │
       ├── Google Calendar API
       ├── Gmail API
       ├── Telegram Bot (polling)
       └── Ollama (local AI)
```

## Requirements

- **Node.js** 20+
- **Docker Desktop** (for PostgreSQL)
- **Git**
- **Ollama** (optional, for AI features in later phases)

## Quick Start

### 1. Clone and install

```bash
git clone <repo-url>
cd lifeflow
npm install
```

### 2. Set up environment

```bash
cp .env.example .env
```

Edit `.env` and fill in:

| Variable | How to get it |
|---|---|
| `DATABASE_URL` | Pre-filled for local Docker Postgres |
| `AUTH_SECRET` | Run `npx auth secret` |
| `GOOGLE_CLIENT_ID` | Google Cloud Console → APIs & Services → Credentials |
| `GOOGLE_CLIENT_SECRET` | Same as above |
| `ENCRYPTION_KEY` | Run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

### 3. Start PostgreSQL

```bash
docker compose up -d
```

This starts a Postgres 16 container on port 5432.

### 4. Run database migration

```bash
npx prisma migrate dev
```

### 5. Start the app

```bash
npm run dev
```

Open http://localhost:3000

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project named "LifeFlow"
3. Go to **APIs & Services → OAuth consent screen**
   - Choose **External** → Create
   - App name: LifeFlow
   - Add your email as support/developer contact
   - Add test users (your email + friends)
4. Go to **APIs & Services → Credentials**
   - Create Credentials → OAuth client ID → Web application
   - Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
5. Copy Client ID and Client Secret into `.env`

### Known limitation: Testing mode

The app stays in Google's **Testing** mode to avoid paid verification. Consequence: refresh tokens for sensitive scopes expire every ~7 days, so users re-authenticate weekly. This is accepted for a private app with <100 users.

## Database

PostgreSQL runs in Docker. Data is persisted in the `postgres_data` volume.

### Schema

- `User` — authenticated users (via Google OAuth)
- `Account` / `Session` — Auth.js session management
- `ConnectedAccount` — encrypted OAuth tokens for Google/Telegram
- `CalendarEvent` — cached Google Calendar events
- `Note` / `NoteTag` — notes with tags
- `Task` — tasks with status, priority, due dates
- `EventNote` / `TaskNote` / `EventTask` — relationship links
- `AutomationRule` — configurable automation triggers

### Backup

```bash
docker exec lifeflow-db pg_dump -U lifeflow lifeflow > backup.sql
```

### Restore

```bash
docker exec -i lifeflow-db psql -U lifeflow lifeflow < backup.sql
```

## Security

- Google OAuth only (no password auth)
- OAuth tokens encrypted at rest (AES-256-GCM)
- Server-side session with HTTP-only cookies
- All queries enforce `userId` ownership
- No tokens exposed to the browser
- `.env` excluded from git

## Project Structure

```
lifeflow/
├── src/
│   ├── app/
│   │   ├── (app)/           # Authenticated routes
│   │   │   ├── dashboard/
│   │   │   ├── calendar/
│   │   │   ├── notes/
│   │   │   ├── tasks/
│   │   │   ├── automations/
│   │   │   ├── ai/
│   │   │   └── settings/
│   │   ├── api/auth/        # Auth.js route handlers
│   │   ├── login/
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/              # shadcn/ui components
│   │   ├── app-sidebar.tsx
│   │   └── session-provider.tsx
│   └── lib/
│       ├── auth.ts          # NextAuth config
│       ├── crypto.ts        # Token encryption
│       └── db.ts            # Prisma client
├── prisma/
│   └── schema.prisma
├── docker-compose.yml
└── .env.example
```

## Development Phases

- [x] **Phase 1** — Foundation (Next.js, Auth, DB, Dashboard shell)
- [x] **Phase 2** — Google Calendar integration
- [ ] Phase 3 — Notes & Tasks CRUD
- [ ] Phase 4 — Telegram bot + daily briefing
- [ ] Phase 6 — Local AI (Ollama)
- [ ] Phase 7 — Gmail appointment detection
- [ ] Phase 8 — Remote access (Cloudflare Tunnel)

## Keeping it at $0

- **Database:** PostgreSQL in Docker on your own PC
- **AI:** Ollama running locally (no API fees)
- **Hosting:** Your PC + Cloudflare Tunnel (free) for remote access
- **Google APIs:** Stay within free quotas with caching + incremental sync
- **No paid services required** for the core workflow

> If your PC is off, the app and automations are unavailable. This is the tradeoff for $0 hosting.
