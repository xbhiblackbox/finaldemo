# Real Insights — Replit Project

## Overview
An Instagram-style mobile web app (React + Vite + Tailwind) that lets users connect their Instagram account, view reel analytics, edit reel insights, and manage access via license keys. Originally built on Lovable with Supabase edge functions — migrated to Replit with a custom Express backend.

## Architecture

### Frontend (`src/`)
- React 18 + Vite + TypeScript
- TailwindCSS + shadcn/ui components
- React Router v6 for navigation
- Key screens: Login, Home, Reels, Profile, Analytics, Reel Insights

### Backend (`server/`)
- Express server on **port 5001**
- Drizzle ORM + PostgreSQL (Replit DB via `DATABASE_URL`)
- Routes mirror the original Supabase Edge Functions

### Dev Setup
- Vite dev server on **port 5000** (webview)
- `/api/*` requests proxied by Vite to `localhost:5001`
- Run: `npm run dev` (starts both via `concurrently`)

## API Routes (server/routes/)
| Route | Purpose |
|-------|---------|
| `POST /api/check-key-status` | Validate license keys, register device fingerprints |
| `POST /api/instagram-scraper` | Fetch Instagram profile/reels/posts/highlights via RapidAPI |
| `GET  /api/ig-image-proxy` | Proxy Instagram CDN images to bypass CORS |
| `POST /api/telegram` | Send Telegram notifications to admins |
| `GET/POST /api/reels-data` | Persist reel edits to PostgreSQL |
| `POST /api/storage/upload` | Upload media files to local `uploads/` dir |
| `GET  /api/storage/files/:filename` | Serve uploaded files |

## Database (server/schema.ts)
- `access_keys` — license keys with device fingerprint tracking
- `reels_data` — per-account per-reel JSON data for cross-device sync

## Environment Secrets Required
- `DATABASE_URL` — auto-provisioned by Replit PostgreSQL
- `RAPIDAPI_KEY` — RapidAPI key for instagram120.p.rapidapi.com
- `TELEGRAM_BOT_TOKEN` — Telegram bot token for admin alerts

## Key Files
- `server/index.ts` — Express entry point
- `server/schema.ts` — Drizzle schema
- `src/integrations/supabase/client.ts` — Supabase adapter (calls own API)
- `src/lib/auth.ts` — License key login logic
- `src/lib/instagramApi.ts` — Instagram data fetching hook
- `src/lib/cloudinary.ts` — File upload utility
- `drizzle.config.ts` — Drizzle config pointing to server/schema.ts
- `vite.config.ts` — Vite with `/api` proxy to port 5001

## Deployment
- Build: `npm run build` (Vite → `dist/`)
- Run: `node ./dist/index.cjs` (Express serves static + API)
- Deploy target: autoscale
