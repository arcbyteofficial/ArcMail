<div align="center">
  <img src="src/assets/arcbyte.co_logo.png" alt="ArcByte Co" height="72" />
  <h1>ArcMail</h1>
  <p>Operator‑grade messaging. Focused webmail for teams that move fast.</p>
  <p>
    <a href="https://mail.arcbyte.co">Frontend</a>
    ·
    <a href="https://api.arcbyte.co/api/health">API Health</a>
  </p>
</div>

ArcMail is a fast, operator‑focused webmail client built with React + Vite on the frontend and an Express API that talks to IMAP/SMTP on the backend.

## Contents

- What’s Included
- Architecture
- Repo Layout
- Local Development
- Environment Variables
- Production Deployment
- Troubleshooting
- Scripts

## What’s Included

- Mail login via IMAP credentials
- Thread list + reading pane UI
- Compose with rich‑text editor
- Mark-as-read synchronization
- Search + filters + voice search (browser SpeechRecognition)
- Attachment download/open

## Architecture

- Frontend: Vite + React + TypeScript
  - API client base URL is controlled by `VITE_API_URL` (falls back to sensible defaults)
- Backend: Node.js + Express
  - Auth: JWT + in‑memory session mapping + CSRF token for write endpoints
  - Mail: IMAP (imapflow) + SMTP (nodemailer)

## Repo Layout

- `src/` Frontend (React)
- `server/index.js` Backend entry (Express)
- `public/` Static assets (and `.htaccess` rewrite for Hostinger/Apache)

## Local Development

Install:

```bash
npm ci
```

Run both API + web:

```bash
npm run dev
```

Run only backend:

```bash
npm run dev:api
```

Run only frontend:

```bash
npm run dev:web
```

Build:

```bash
npm run build
```

Lint / typecheck:

```bash
npm run lint
npx tsc -b
```

## Environment Variables

### Frontend (Vite)

- `VITE_API_URL`
  - Example (production): `https://api.arcbyte.co`
  - Example (local): `http://localhost:5050`
  - The client normalizes this to `.../api`.

### Backend (Railway / Node)

Required in production:

- `NODE_ENV=production`
- `JWT_SECRET` Strong random secret
- `SESSION_SECRET` Strong random secret (different from JWT_SECRET recommended)
- `CORS_ORIGIN` Comma-separated allowlist
  - Example: `https://mail.arcbyte.co`

Mail server defaults (Hostinger):

- `IMAP_HOST` (default: `imap.hostinger.com`)
- `IMAP_PORT` (default: `993`)
- `SMTP_HOST` (default: `smtp.hostinger.com`)
- `SMTP_PORT` (default: `465`)

Optional tuning:

- `IMAP_LOGIN_METHOD`
- `IMAP_CONNECTION_TIMEOUT`, `IMAP_GREETING_TIMEOUT`, `IMAP_SOCKET_TIMEOUT`
- `IMAP_TLS_REJECT_UNAUTHORIZED`
- `SMTP_TLS_REJECT_UNAUTHORIZED`
- `IMAP_TLS_CA_FILE`, `SMTP_TLS_CA_FILE`
- `DEBUG_ERRORS=true` (exposes safe SMTP error details in responses; use only while debugging)

## Production Deployment

### Backend on Railway (api.arcbyte.co)

- Start command: `npm start` (runs `node server/index.js`)
- Health check: `GET /api/health`
- Set the backend env vars listed above

### Frontend on Hostinger (mail.arcbyte.co)

Two common approaches:

1) Static upload (recommended)
- Build locally with `VITE_API_URL=https://api.arcbyte.co`
- Upload `dist/` contents into `public_html/`
- Copy `public/.htaccess` to `public_html/.htaccess` for SPA routing

2) Hostinger Git Deploy + Node build
- Configure the app to run `npm ci && npm run build`
- Serve the built output (for example with `npm run preview -- --host 0.0.0.0 --port $PORT`)
- Ensure `VITE_API_URL=https://api.arcbyte.co` is set in Hostinger’s environment variables

## Troubleshooting

- Login returns `not_found` when opened in a browser tab
  - The login endpoint is POST-only. Use `POST /api/auth/mail-login`.

- CORS errors in production
  - Confirm `CORS_ORIGIN` includes your frontend domain exactly (e.g. `https://mail.arcbyte.co`).

- “Failed to send. Verify SMTP access…”
  - Enable `DEBUG_ERRORS=true` temporarily and retry to see the SMTP code/message.
  - If the error is `EAUTH`, verify SMTP credentials/app-password.
  - If it’s `ETIMEDOUT`/`ECONNREFUSED`, the host/network may block outbound SMTP; try port 587 (STARTTLS) or a relay.

- Attachments show but won’t open
  - Ensure the backend is updated and the frontend is pointing at the same environment (local vs production).

## Scripts

See `package.json`:

- `dev` Run API + web in parallel
- `dev:api` Run backend only
- `dev:web` Run frontend only
- `build` Typecheck + build frontend
- `lint` ESLint
- `start` Run backend (production)

---

Copyright © 2026 ArcByte Co. Powered by ArcByte Co.
