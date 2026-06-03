# SHILLIT AI — React UI

Vite + React + TypeScript frontend for the `POST /api/generate` backend. The API endpoint is configurable in one place, so you just point it at your BE.

## 1. Setup

```bash
npm install
cp .env.example .env
```

## 2. Point it at your backend

Edit `.env`. Two modes:

**Mode A — same-origin + dev proxy (recommended for local dev).**
Leave `VITE_API_BASE` empty. The app calls `/api/generate`, and Vite proxies `/api` to your backend. No CORS needed.
```
VITE_API_BASE=
VITE_DEV_PROXY_TARGET=http://localhost:8787   # your backend
```

**Mode B — absolute backend URL.**
Set the full base. The app calls `<base>/api/generate`. **You must enable CORS on the backend** (different origin).
```
VITE_API_BASE=https://api.yourdomain.com
```
Express CORS one-liner: `npm i cors` then `app.use(cors({ origin: "https://your-frontend-origin" }))`.

> All request logic lives in `src/api.ts` — that's the only file you touch to change endpoints.

## 3. Run

```bash
npm run dev        # http://localhost:5173
npm run build      # type-check + production build -> dist/
npm run preview    # preview the production build
```

Deploy `dist/` to any static host (Vercel/Netlify/Cloudflare/S3). Set `VITE_API_BASE` at build time for prod.

## Expected backend contract

`POST /api/generate`
```json
// request
{ "ca": "0x...", "chain": "eth", "tone": "hype", "language": "en" }
// success 200
{ "market": { "symbol": "...", "priceUsd": 0, "marketCap": null, "fdv": 0,
              "volume24h": 0, "liquidityUsd": 0, "priceChange24h": 0,
              "txns24h": { "buys": 0, "sells": 0 }, "source": "...", "chain": "..." },
  "post": "..." }
// error (any non-2xx)
{ "error": "code", "message": "human readable" }
```
Error `message` is surfaced directly in the UI. Network/CORS/timeout failures show as a network error.

## Structure
```
src/
├─ App.tsx        # UI + state
├─ api.ts         # << configure backend endpoint here
├─ types.ts       # shared response types (mirror your BE)
├─ styles.css     # dApp terminal theme
├─ main.tsx
└─ vite-env.d.ts
vite.config.ts    # dev proxy
.env.example
```
