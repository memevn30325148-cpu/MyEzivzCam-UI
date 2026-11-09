# AGENTS.md

Guide for AI agents and developers working on **MyEzvizCam Pro**, the web/mobile/PC client for the MyEzvizCam Pro camera backend.

## What this project is

A responsive, installable (PWA) client for the Python MyEzvizCam Pro backend (ONVIF/RTSP cameras, MJPEG live view, PTZ, Telegram Cloud Vault clips). This repo has **no camera logic of its own**: it implements the UI from the supplied design and talks to the backend's REST contract (`/api/v1/*`). It ships with an in-browser demo backend so the app is fully usable before a real backend is connected.

Screens (all Vietnamese UI):

| Route     | File                    | Purpose                                                                 |
| --------- | ----------------------- | ----------------------------------------------------------------------- |
| `/login`  | `src/routes/login.tsx`  | Login, 401/429 handling, demo credential hint                           |
| `/`       | `src/routes/index.tsx`  | Live view: camera switcher, KPIs, MJPEG feed, quality, pause, snapshot, PTZ pad, ONVIF motion card |
| `/events` | `src/routes/events.tsx` | Event list (filters by camera/date), signed-URL playback, download, manual clip trigger |
| `/system` | `src/routes/system.tsx` | Storage/consent/queue status, ONVIF listeners, camera capabilities      |

## Architecture

```
Browser (PWA) ──same origin──> /api/v1/*  ──Netlify Edge Function──> EZVIZ_BACKEND_URL (Python API)
                                     │
                                     └─ not configured → 503 BACKEND_NOT_CONFIGURED → UI uses demo backend
```

- **Why a proxy:** the backend sets `session_id` as `HttpOnly; SameSite=Strict`. Cookies only flow if UI and API share an origin, so `netlify/edge-functions/api-proxy.ts` forwards `/api/v1/*` to `EZVIZ_BACKEND_URL` and streams the body back unchanged (MJPEG `multipart/x-mixed-replace`, `206 Partial Content` for Range playback, `Set-Cookie`).
- **Mode detection:** `probeBackend()` in `src/lib/api/http.ts` calls `GET /api/v1/auth/me`. A JSON answer other than `BACKEND_NOT_CONFIGURED` → live mode (`httpApi`); otherwise demo mode (`demoApi`). A non-JSON response (plain `vite dev`) also means demo mode.
- **One interface, two implementations:** `CamApi` in `src/lib/api/types.ts`. `httpApi` (real REST) and `demoApi` (`src/lib/api/demo.ts`, with sample data in `src/lib/api/fixtures.ts`). Screens only use `useApi()` / `useSession()` from `src/lib/api/index.tsx`, never `fetch` directly.
- **Session:** `SessionProvider` (mounted in `__root.tsx`) holds the API, the auth phase and the user. Any 401 (except during login) calls `emitUnauthorized()` → user cleared → `AppShell` redirects to `/login?redirect=…`.

## Key directories

```
netlify/edge-functions/api-proxy.ts  Same-origin proxy to the Python backend
public/manifest.webmanifest          PWA manifest (install on Android/iOS/Windows/macOS)
public/icons/                        App icons (SVG sources + generated PNGs)
public/img/cam-*.jpg                 Demo camera frames (simulated live feed / playback)
src/app.css                          The whole design system (tokens, components, responsive rules)
src/components/app/                  Product components: app-shell, live-feed, ptz-pad, event-player, sheet, toast, kpi, icons
src/lib/api/                         Types, HTTP client, demo backend, fixtures, session context
src/lib/format.ts                    Vietnamese labels (capabilities, statuses, PTZ text) + date/size formatting
src/lib/use-async.ts                 Tiny fetch hook with silent polling (pauses when tab hidden)
```

`src/components/ui/` and `src/examples/` are unused template leftovers (shadcn/ui). The product UI is hand-built with the plain CSS classes in `src/app.css`, which mirror the supplied design file (`.card`, `.btn.p`, `.seg`, `.chip`, `.b1..b4` badges, `.kv`, `.vid`, `.ov`, `.pt`, `.row`, `.kpi`, `.g1/.g2/.g3`).

## Backend contract rules the UI must keep

These come from the backend handoff document; don't regress them:

1. All requests use `credentials: 'include'`; every POST sends `Content-Type: application/json` (otherwise 415).
2. 429 on login → show exactly "Tài khoản tạm thời bị khóa do thử sai quá nhiều lần. Vui lòng thử lại sau 15 phút."
3. MJPEG `<img>` must get `src = ""` when paused, unmounted, camera switched or tab hidden (`live-feed.tsx`).
4. Enable PTZ only when `capabilities` includes `ptz_continuous`. PTZ status text uses `PTZ_LABEL` (▲ Đang xoay lên …), never raw backend messages, and clears via `setTimeout` (stop text after 1 s).
5. Playback is two-step: `POST /playback/sign` → `<video src={signed_url}>`. Only `COMPLETED` events are playable; other statuses show a badge and disabled play button. On player close/switch: `pause()` + remove `src` + `load()`.
6. Any 401 → back to login.

## Responsive rules

- `> 1024px`: sidebar + two-column grids (player column sticky on Events).
- `≤ 1024px`: single column; Events uses cards and opens the player in a bottom sheet.
- `≤ 900px`: sidebar replaced by sticky top bar + bottom tab bar (safe-area aware for iOS standalone mode).

## Conventions

- TypeScript strict; no unused locals/params. Import with `@/`.
- Read `localStorage`/`window` only inside effects (pages are SSR'd by TanStack Start).
- Route files export only `Route`; shared pieces live in `src/components/app/`.
- Add new backend endpoints to `CamApi` first, then implement them in **both** `httpApi` and `demoApi`.
- All user-facing copy is Vietnamese.

## Configuration

| Env var             | Where            | Purpose                                                       |
| ------------------- | ---------------- | ------------------------------------------------------------- |
| `EZVIZ_BACKEND_URL` | Netlify site env | Public base URL of the Python API (e.g. a tunnel URL). Unset → demo mode. |

## Commands

```bash
npm run dev                                   # Vite only (demo mode, proxy not active)
netlify dev                                   # Vite + edge proxy (set EZVIZ_BACKEND_URL locally to hit a real backend)
npm run typecheck | npm run lint | npm test
```

Possible next steps are listed under "Hướng phát triển tiếp" in `README.md`.
