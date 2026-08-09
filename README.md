# Satellite Telemetry Dashboard

A React + TypeScript web app for viewing, filtering, adding, and deleting satellite
telemetry entries (Satellite ID, Timestamp, Altitude, Velocity, Health Status). It can talk
to the real Satellite Telemetry API in `../backend` or to a built-in in-memory mock,
switchable via configuration (see below) with no code changes.

## Tech Stack

- **React 18 + TypeScript** — UI and type safety
- **Vite** — dev server / build tool (also proxies API requests, see below)
- **Vitest + React Testing Library** — unit tests
- Plain CSS (no UI framework) for a small, dependency-light bundle

## Configuration: real backend vs. mock API

The app can talk to either the real FastAPI backend or a self-contained in-memory mock,
switched purely via configuration — no code changes needed:

| `VITE_API_MODE` | Client used | Requires backend running? |
|------------------|-------------|----------------------------|
| `real` (default, i.e. unset) | `src/api/realTelemetryApi.ts` | Yes — `../backend` on port 3000 |
| `mock` | `src/api/mockTelemetryApi.ts` | No |

Set it in a `.env.local` file (copy `.env.example`) or inline when starting the dev server:

```bash
# PowerShell — use the mock API, no backend needed
$env:VITE_API_MODE="mock"; npm run dev

# bash/zsh
VITE_API_MODE=mock npm run dev
```

`src/api/telemetryApi.ts` is the single entry point every component/hook imports from; it
re-exports whichever client is active. Both clients share the same function signatures
(`getTelemetry`, `createTelemetry`, `deleteTelemetry`, `ApiError`, `setSimulateFailures`), so
the rest of the app behaves identically either way.

In **dev mode** (`npm run dev`), the header shows a "Live API" / "Mock API" badge and a
"Simulate backend outage" toggle. Those controls are hidden in production builds
(`import.meta.env.DEV`).

### Why a dev proxy instead of calling `localhost:3000` directly

The backend doesn't send `Access-Control-Allow-Origin` headers, so a browser `fetch` from
the Vite dev server's origin (`http://localhost:5173`) straight to `http://localhost:3000`
would be blocked by CORS. Rather than modify the backend, `vite.config.ts` proxies
`/telemetry` and `/health` to `http://localhost:3000` so the browser only ever talks to its
own origin:

```ts
server: {
  proxy: {
    '/telemetry': backendTarget, // http://localhost:3000 by default
    '/health': backendTarget,
  },
},
```

`src/api/realTelemetryApi.ts` therefore calls relative paths (e.g. `/telemetry`) by default. If
your backend runs on a different port, override it before starting the dev server:

```bash
# PowerShell
$env:VITE_API_PROXY_TARGET="http://localhost:4000"; npm run dev
```

If you'd rather call an API host directly (e.g. one that already sends CORS headers, or in
a production build with no dev-server proxy), set `VITE_API_BASE_URL` in a `.env.local` file
instead — requests will go straight to that origin and skip the proxy.

## Getting Started

Requires Node.js 18+.

```bash
npm install
npm run dev
```

Then open the printed local URL (typically http://localhost:5173) — with the backend running
on port 3000 as described above.

Other scripts:

```bash
npm run build      # type-check + production build
npm run preview    # preview the production build locally
npm run test        # run the unit test suite once
npm run test:watch  # run tests in watch mode
npm run lint        # lint the codebase
```

## Features

- **Telemetry table** with columns for Satellite ID, Timestamp (UTC, including milliseconds),
  Altitude, Velocity, and Health Status (color-coded badges; unrecognized status strings still
  render with a neutral badge, since the backend treats `status` as free-form text).
- **Filtering** by Satellite ID and Health Status, applied server-side (`GET
  /telemetry?satelliteId=&status=`) — only matching rows are fetched, so the table stays fast
  as the data set grows instead of downloading everything up front. Dropdown options are
  discovered from the data seen so far plus the known `healthy` / `warning` / `critical`
  values, independent of the currently active filter.
- **Sorting** by Timestamp, Altitude, or Velocity — click a column header to toggle
  ascending/descending order. Sorting stays client-side (over whatever the active filter
  currently has loaded), since the API has no sort parameter.
- **Add entry form** opened from an "Add Telemetry Entry" button (collapsed by default).
  Client-side validation mirrors the backend's rules (non-empty Satellite ID, valid UTC
  date/time, altitude/velocity strictly greater than 0). Timestamp is a plain text field that
  auto-formats as you type (`YYYY-MM-DD HH:mm:ss.SSS`, UTC) and is submitted as ISO 8601.
- **Delete** with an inline confirmation step, plus a disabled/spinner state on the affected
  row while the request is in flight.
- **Loading spinner** while the initial data set is being fetched.
- **Error handling**: a banner surfaces API failures — network errors, and FastAPI's 422
  validation / 404 "not found" responses are parsed into readable messages — with
  Retry/Dismiss actions. In dev mode, a "Simulate backend outage" toggle forces every API call
  to fail client-side so you can exercise the error/retry flow on demand.
- **Responsive layout**: the form and filters reflow on narrow screens, and the table
  scrolls horizontally on small viewports.

## Architecture

```
src/
  api/
    telemetryApi.ts        Facade: picks real vs. mock client based on VITE_API_MODE
    realTelemetryApi.ts    Real client: GET/POST/DELETE against the FastAPI backend, sending
                            satelliteId/status as query params and paginating through
                            GET /telemetry (within that filter) and parsing error responses
    mockTelemetryApi.ts    In-memory fake client with the same function signatures
    ApiError.ts            Error type shared by both clients
  hooks/useTelemetry.ts    All telemetry state: server-filtered fetch/add/delete, loading &
                            error flags, and the filter dropdowns' known-value lists
  components/
    TelemetryTable.tsx     Sortable table + delete with confirmation
    TelemetryFilters.tsx   Satellite ID / Health Status filters
    TelemetryForm.tsx      Validated, toggleable "add entry" form (UTC timestamp text field)
    HealthBadge.tsx        Color-coded status pill (falls back gracefully for unknown values)
    Spinner.tsx            Small loading indicator
    ErrorBanner.tsx        Error message with retry/dismiss
  utils/
    format.ts              UTC timestamp + number formatting for the table
    timestampInput.ts      Masked UTC timestamp typing / parsing for the form
  App.tsx                  Composes the above; owns filter/sort UI state; dev-only header tools
  types.ts                 Shared TelemetryEntry type + known status values
```

State management uses React's built-in `useState`/`useMemo`/`useCallback` via a single
`useTelemetry` hook, rather than Redux — the state shape (a list + loading/error/mutation
flags) is simple enough that a custom hook keeps things easy to follow while still cleanly
separating data concerns from presentation. `App.tsx` passes the active filters into
`useTelemetry`, which re-fetches from the server whenever they change; only sorting is left as
derived state (`useMemo` over whatever's currently loaded).

## API contract

| Method   | Path             | Notes |
|----------|------------------|--------|
| `GET`    | `/telemetry`     | Filters: `satelliteId`, `status`. Pagination: `page` (default 1), `limit` (default 10). Response: `{ items, page, limit, hasMore }` — no total count. The real client walks pages until `hasMore` is false. |
| `POST`   | `/telemetry`     | Body: `{ satelliteId, timestamp, altitude, velocity, status }`. `timestamp` must be strict ISO 8601; `altitude`/`velocity` must be `> 0`. |
| `GET`    | `/telemetry/:id` | Single entry (not used by the UI today). |
| `DELETE` | `/telemetry/:id` | Deletes one entry. |
| `GET`    | `/health`        | Health check (proxied in dev; not required by the UI). |

Interactive docs when the backend is running: `http://localhost:3000/docs`.

## Testing

Unit tests cover:

- `realTelemetryApi.test.ts` — pagination aggregation, filters sent as query params, the
  `peekSatelliteIds` helper, and FastAPI 422/404 error parsing (response shapes verified
  against the running backend via `curl`).
- `mockTelemetryApi.test.ts` — the in-memory client's CRUD behavior, server-side filtering, and
  validation.
- `telemetryApi.test.ts` — the facade actually switches implementation based on
  `VITE_API_MODE`.
- `useTelemetry.test.ts` — re-fetching when filters change, add/delete, and error surfacing.
- `timestampInput.test.ts` — UTC mask formatting / parsing for the form timestamp field.
- Each component (table sorting + delete confirmation, filter changes, form validation and
  submission, error/loading states), and an end-to-end flow in `App.test.tsx` (load →
  server-filter → add → delete → simulated outage), with a fake `fetch` that actually applies
  `satelliteId`/`status` query params so the filtering tests exercise real request/response
  round trips.

All network calls are mocked (`fetch` is stubbed) so the whole suite runs without either the
backend or a real network connection.

```bash
npm run test
```
