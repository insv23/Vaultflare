# Vaultflare

Self-hosted password manager built on Cloudflare's free tier. Zero-knowledge encryption — your master password never leaves the client.

## Architecture

```
Browser ──► Cloudflare CDN
               │
               ├─ /* ──────► vaultflare-web (Static Assets Worker)
               └─ /api/* ──► backend (Hono Worker) ──► D1 Database
```

- **backend/** — Hono + Cloudflare Workers + D1. Handles auth, encrypted vault CRUD, and OpenAPI docs.
- **web/** — React SPA served by Cloudflare Workers Static Assets.
- **chrome-extension/** — Chrome Extension (Manifest V3), calls the same API.

All three projects live in one repo but are **independent** — no shared dependencies, no monorepo tooling. Each has its own `package.json` and deploys separately.

## Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [pnpm](https://pnpm.io/) >= 9
- A [Cloudflare](https://dash.cloudflare.com/) account (free plan works)
- A domain added to your Cloudflare account
- `wrangler` CLI (installed as a dev dependency in each project, or globally via `pnpm add -g wrangler`)

## Deployment

### 1. Clone the repository

```bash
git clone https://github.com/insv23/Vaultflare.git
cd Vaultflare
```

### 2. Deploy the backend

```bash
cd backend
pnpm install
```

**Create a D1 database:**

```bash
npx wrangler d1 create vaultflare
```

Copy the output `database_id` and paste it into `backend/wrangler.jsonc`:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "vaultflare",
    "database_id": "<your-database-id>"
  }
]
```

**Initialize the schema:**

```bash
npx wrangler d1 execute vaultflare --remote --file=db/schema.sql
```

**Deploy:**

```bash
pnpm deploy
```

### 3. Deploy the web frontend

```bash
cd ../web
pnpm install
pnpm deploy
```

### 4. Bind to your domain

In the Cloudflare dashboard, add two **Workers Routes** under your domain:

| Route pattern | Worker |
|---|---|
| `your-domain.com/api/*` | `backend` |
| `your-domain.com/*` | `vaultflare-web` |

> **Order matters.** The more specific `/api/*` route must be listed first (or Cloudflare will match `/*` and send API requests to the web worker).

Alternatively, set routes in each project's `wrangler.jsonc`:

**backend/wrangler.jsonc:**
```jsonc
"routes": [
  { "pattern": "your-domain.com/api/*", "zone_name": "your-domain.com" }
]
```

**web/wrangler.jsonc:**
```jsonc
"routes": [
  { "pattern": "your-domain.com/*", "zone_name": "your-domain.com" }
]
```

Then re-deploy both workers for routes to take effect.

### 5. Configuration

Environment variables are set in `backend/wrangler.jsonc` under `"vars"`:

| Variable | Default | Description |
|---|---|---|
| `ALLOW_REGISTRATION` | `"true"` | Set to `"false"` to disable new 
user registration after you've created your account. |

To change a variable, edit `wrangler.jsonc` and re-deploy, or use the Cloudflare dashboard (Workers > Settings > Variables).

## Local Development

**Backend:**

```bash
cd backend
pnpm install
pnpm dev          # Starts on http://localhost:8787
```

Local endpoints:
- `http://localhost:8787/api/health` — health check
- `http://localhost:8787/api/docs` — Scalar API docs
- `http://localhost:8787/api/openapi.json` — OpenAPI spec

**Web:**

```bash
cd web
pnpm install
pnpm dev          # Starts on http://localhost:5173
```

The Vite dev server proxies `/api/*` requests to `http://localhost:8787`, so run both simultaneously for full-stack development.

## License

MIT
