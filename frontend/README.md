# LogiTrack — logistics intelligence

An original midnight command center for the existing ASP.NET Core API. Includes a responsive workspace, secure sign-in and registration, Manager-aware inventory/order workflows, real-data analytics, light/dark themes, device preferences, export, and an interactive procedural warehouse.

## Run on macOS

From the project root (`~/Downloads/LogiTrack`), in two terminals:

```bash
./scripts/run-mac.sh
```

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000. API: http://127.0.0.1:5187. Existing manager credentials remain in the root `.env`; they are never sent to the frontend bundle. Registration creates a read-only account. Manager role assignment is controlled by the backend.

The frontend server uses `API_URL` (preferred), then the existing `NEXT_PUBLIC_API_URL`, then the loopback development default. Configure `API_URL` as a deployment environment variable; no browser API URL or CORS change is necessary. Do not put credentials or JWT signing keys in public environment variables. Production requires HTTPS: session cookies are Secure in production.

## Architecture

- Next.js 16 App Router, strict TypeScript, React, Tailwind v4, Geist, Nova/Base UI components, Lucide, Recharts.
- Protected server layout and same-origin `/api/gateway/*` route handler forward requests to the existing API. The JWT lives in an HttpOnly, SameSite=Strict, one-hour cookie. POST and DELETE enforce matching Origin. The API validates every JWT and Manager permission. Decoded server claims only customize presentation.
- The proxy restricts paths/methods, avoids upstream redirects, times out requests, clears expired sessions, and returns non-sensitive connection errors. No token is stored in localStorage. Preferences alone use localStorage.
- Inventory search, location filters, name/stock sorting, pagination, details, validated creation and confirmed deletion. Orders support multiple lines, live availability limits, details, creation and deletion with stock restoration.
- Analytics derive location stock, top items, low stock (≤10 units) and daily order counts from API records. Date filtering applies to orders. Deleted orders are excluded; there is no invented shipping, revenue or fulfillment data.
- Heavy charts and the warehouse load separately. Three.js + React Three Fiber + Drei render original procedural racks, packages, paths and a moving vehicle. Zone controls transition the camera. Pointer movement, a subtle scroll-driven tilt, and orbit controls provide interaction. Three.js is pinned to the 0.182 compatible release line because the current Fiber/Drei stack still uses APIs deprecated in 0.183 or removed in 0.186. The facility is conceptual, not a live spatial model.
- Scene resolution is capped at 1.5 DPR; the scene stops continuous rendering when hidden, outside the viewport or reduced motion is enabled. WebGL failure has a lightweight fallback. Business workflows never require WebGL. CSS entrance and hover transitions honor reduced motion.

## Verify

```bash
npm run lint
npx tsc --noEmit
npm run build
npm audit
npm audit --omit=dev
npm test
```

Browser tests require the root `.env` with bootstrap manager credentials, a running backend, and a Playwright Chromium install (`npx playwright install chromium` if needed). They cover anonymous navigation, CSRF rejection, registration/login, viewer restrictions, inventory/order creation and deletion, API failure recovery, cookie flags, and mobile overflow/navigation. Tests use uniquely named temporary inventory/orders and remove them on the successful path. The existing API script creates a temporary user and has no account-deletion endpoint. Frontend registration tests remove their exact newly created viewer account from the local SQLite database in teardown. Browser traces are disabled to avoid recording authentication requests. Do not run production write tests against a production database.

Backend checks, from project root:

```bash
dotnet restore
dotnet build
dotnet list package --vulnerable --include-transitive
set -a
source .env
set +a
python3 scripts/test-api.py
python3 scripts/test-stock.py
```

`test-stock.py` verifies duplicate line aggregation, multi-line transaction rollback, concurrent requests, exact restoration and cleanup. Backend stock deductions use conditional SQL updates inside the order transaction. Inventory reads bypass the former list cache to prevent stale stock from racing cache invalidation. No schema changes or database reset are needed. Authentication also enforces bounded input sizes and explicit HS256 validation; bootstrap role assignment requires proof of the configured password before promoting an existing account.

## Security status

See [SECURITY.md](SECURITY.md). The full npm audit remains nonzero because no compatible patched upstream braces release is published. Do not use `npm audit fix --force`. Production dependencies audit clean. shadcn remains compatible at its existing major and is classified as development tooling. Existing generated components and shadcn styles remain in use.

## Repository and limitations

Only `frontend/` is a Git repository; there is no parent Git repository, so it is not nested. Existing uncommitted components and package changes were retained. Backend changes are outside frontend Git tracking: initialize a root repository deliberately if you want unified history, after reviewing ignored secrets/database files. Nothing is committed or pushed.

Profile editing, password changes, session revocation, shipment tracking and notification feeds are not provided by the current API. The UI states these limits. Logout clears this browser’s cookie; already issued JWTs remain valid until expiry. Production readiness also requires deployment-specific TLS, secret management, backups, monitoring, request-rate limits, recovery flows and load testing. The concurrency test verifies a local SQLite scenario, not unrestricted multi-node behavior.

## Demo catalog

From `~/Downloads/LogiTrack`, run `python3 scripts/seed-demo.py` with the API running. Run `python3 scripts/seed-demo.py --verify-only` to check imported records. The importer uses existing Manager environment configuration and creates 50 `[DEMO LT1]` products and 25 uniquely marked orders through the API. Normal reruns add zero records and preserve later business activity.

See [the root README](../README.md#realistic-demo-data) for category counts, warehouse codes, stock distribution, manifest recovery, duplicate prevention and limitations. The ignored `.local/demo-seed-v1.json` manifest belongs to this API/database; retain it with backups. Ambiguous pending requests stop safely rather than retry a potentially committed order. No schema or credential changes are required.

Analytics now shows live availability counts and authenticated product order-frequency aggregation. The conceptual 3D warehouse uses real inventory summaries by city and grouped location codes, while retaining its existing appearance and camera interactions.
