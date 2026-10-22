# LogiTrack

LogiTrack is a local logistics inventory and order management application with an ASP.NET Core REST API and a Next.js command center. It combines authenticated inventory/order workflows, real-data analytics and a procedural 3D warehouse overview.

## Project layout

```text
LogiTrack/
├── backend/
│   ├── Controllers/
│   ├── DTOs/
│   ├── Data/
│   ├── Models/
│   ├── Services/
│   ├── Migrations/
│   ├── Properties/
│   ├── Program.cs
│   ├── appsettings.json
│   └── LogiTrack.csproj
├── frontend/
│   ├── src/
│   ├── public/
│   ├── tests/
│   ├── package.json
│   └── package-lock.json
├── scripts/
├── README.md
└── .gitignore
```

The local `.env`, `logitrack.db` and `.local/` directory remain at the project root and are excluded from version control. Backend business code, entity relationships and migrations are preserved. Relative SQLite data sources are resolved against the parent of the backend content root, so the existing root database is used even though the project now lives in `backend/`. Absolute database overrides remain absolute. EF design-time operations locate the backend project independently of the invoking directory and use the same database-resolution rule.

## Stack

- ASP.NET Core 10, C#, Entity Framework Core 10 and SQLite.
- ASP.NET Core Identity, JWT bearer authentication and Manager-role authorization.
- Next.js 16 App Router, React, strict TypeScript, Tailwind CSS v4, Nova/Base UI components, Geist and Lucide.
- Recharts analytics and Three.js / React Three Fiber / Drei procedural warehouse visualization.

## Local development

Requires the .NET 10 SDK, Node.js/npm and Python 3. For a fresh checkout, install frontend packages with `cd frontend && npm ci` and restore the backend with `dotnet restore backend/LogiTrack.csproj`. Existing installations do not need reinstalling for the folder move.

From the project root, use separate terminal tabs:

```bash
bash scripts/run-mac.sh
```

```bash
cd frontend
npm run dev
```

Alternatively, `bash scripts/dev-all.sh` runs both servers. Check that ports 5187 and 3000 are free before starting another server. API: `http://127.0.0.1:5187`; frontend: `http://localhost:3000`. Swagger/OpenAPI is exposed only in Development at `/swagger`; a Swagger bearer authorization definition is not configured.

The backend launcher reads root `.env` and then enters `backend/`. If `.env` does not exist, it creates random local credentials using the existing bootstrap mechanism and restrictive file permissions. Existing `.env` is never overwritten. Startup applies existing migrations and provisions the configured bootstrap account when necessary. Review `scripts/setup-mac.sh` before using it: it restores/builds, can install the EF tool if absent, and updates the database; it is not a read-only verification command.

### Environment

Backend environment keys:

- `Jwt__Key`: secret signing key of at least 32 bytes.
- `Bootstrap__ManagerEmail` / `Bootstrap__ManagerPassword`: optional bootstrap account configuration; keep server-side.
- `ConnectionStrings__DefaultConnection`: optional SQLite override. For isolated tests, use an absolute path, for example `Data Source=/absolute/private/test.db`. Relative data sources are anchored to the project root.

The frontend server uses `API_URL`, then the existing `NEXT_PUBLIC_API_URL`, then `http://127.0.0.1:5187`. Prefer server-only `API_URL` for deployments. The browser uses the same-origin `/api/gateway/*` boundary. Never place JWT keys, Manager passwords or access tokens in public environment variables.

New registrations have read access and do not become Managers. Use the existing configured Manager account for writes. Login returns a backend JWT that the frontend keeps in an HttpOnly, SameSite=Strict cookie, Secure in production. Logout clears this browser's cookie; previously issued JWTs remain valid until expiration.

## API and business rules

| Method | Path | Access |
|---|---|---|
| GET | `/health` | Public |
| POST | `/api/auth/register`, `/api/auth/login` | Public |
| GET | `/api/inventory` | Authenticated |
| POST | `/api/inventory` | Manager |
| DELETE | `/api/inventory/{id}` | Manager |
| GET | `/api/orders`, `/api/orders/{id}`, `/api/orders/analytics` | Authenticated |
| POST | `/api/orders` | Manager |
| DELETE | `/api/orders/{id}` | Manager |

Order creation groups duplicate product lines and conditionally deducts stock inside a transaction. Insufficient stock or missing products reject the operation without partial allocation. Deleting an order restores stock transactionally. Inventory referenced by an order cannot be deleted. There is no PUT/PATCH editing, shipment tracking, payment processing or invented fulfillment status.

Identity, products, orders and order lines persist in SQLite. OrderItem has a composite order/product key; order-line deletion cascades with orders, while inventory references are restricted. Inventory is read fresh: IMemoryCache is registered and removal calls remain, but no populated business-data cache is active. No Redis service is implemented.

## Dashboard and analytics

The dashboard calculates inventory record count, available units, recorded orders and low-stock products from API responses. Low stock means quantity ≤10, including out-of-stock products. Analytics shows stock by location, top inventory, availability, recorded daily orders and the most frequently ordered products. Order frequency covers all surviving orders; the daily trend has its own date selector. Deleted orders are excluded from historical calculations.

The conceptual warehouse summarizes inventory by city and grouped location codes. Rack highlights reflect availability. Its geometry, vehicle and route are illustrative, not a physical warehouse map or shipment telemetry. Heavy components load separately, device pixel ratio is capped, and rendering pauses offscreen/when hidden or reduced motion is enabled. Critical operations work without WebGL.

React state/effects manage interaction and fetched data; Context supplies account information. Mutations reload the API lists. Appearance/motion preferences persist on the device. Other users' changes require refresh/navigation; no live synchronization service is implemented.

## Demo data

With the API running, from project root:

```bash
python3 scripts/seed-demo.py
python3 scripts/seed-demo.py --verify-only
python3 scripts/test-seed-demo.py
```

The importer reads existing Manager environment configuration and creates 50 `[DEMO LT1]` products across six categories and 40 warehouse codes, plus 25 marked orders through the API. Warehouse codes cover LHR-A01–A10 (Lahore), KHI-B01–B10 (Karachi), ISB-C01–C10 (Islamabad) and MUX-D01–D10 (Multan). Categories are catalog metadata; no schema addition is required.

Initial post-order stock is 10,726 units: 30 healthy, 10 medium, 7 low and 3 empty products. Orders have actual import timestamps, not fabricated historical dates. Later legitimate activity may change totals.

Normal reruns create zero extra records and preserve current stock. The importer reconciles reserved names/unique order markers and persists atomic progress in ignored root `.local/demo-seed-v1.json`, protected by a local lock. Keep that manifest with the corresponding database backup. Lost committed responses can be reconciled; ambiguous pending requests without a matching record stop for review rather than blindly repeat a POST. Missing/changed confirmed records also stop safely. Do not delete a manifest to reset the demo, reuse reserved markers for real records, or run simultaneous seeders from separate checkouts: there is no global API idempotency-key constraint. `--verify-only` does not insert business records, but authenticates and updates manifest reconciliation state.

## Verification

```bash
dotnet restore backend/LogiTrack.csproj
dotnet build backend/LogiTrack.csproj --no-restore
dotnet list backend/LogiTrack.csproj package --vulnerable --include-transitive
python3 scripts/test-seed-demo.py

cd frontend
npm run lint
./node_modules/.bin/tsc --noEmit --incremental false
npm run build
npm audit
npm audit --omit=dev
```

From root, the existing EF commands now require `--project backend/LogiTrack.csproj --startup-project backend/LogiTrack.csproj`. They use root SQLite by default. Do not run database updates merely to inspect an existing installation; use an explicit absolute test-database override when testing migrations.

### Write-capable tests

`python3 scripts/test-api.py` and `python3 scripts/test-stock.py` require a running API. They create/delete temporary business records; the first also registers a user. Set `LOGITRACK_URL` to an isolated test API and configure that server with an absolute `ConnectionStrings__DefaultConnection` pointing to a separate database. Load Manager credentials from a trusted environment without printing them. Never aim these tests at the existing database unless you deliberately intend those writes.

`npm test` in frontend runs browser workflows. It requires a running backend, Playwright Chromium and Manager configuration in the test checkout's parent `.env`. The registration teardown opens `../logitrack.db` directly, so overriding the API URL alone is insufficient for isolation. Use a separate test checkout with its own root database and configure both frontend/backend URLs to isolated ports. The demo browser test expects the demo catalog. No production-data cleanup/reset should be used to prepare these tests.

## Security and repository hygiene

Keep environment files, SQLite databases/journals, local seed state, dependency/build output and test artifacts private. The root ignore policy also excludes local assignment/audit material and AI instruction/prompt files while retaining application assets in frontend public/source asset directories. No GitHub repository is automatically created by the startup scripts.

The latest checks reported no vulnerable NuGet packages and zero production npm dependency findings. The full npm audit still reports nine high development-tooling findings from the braces advisory GHSA-vfj7-8cjw-p6xm through ESLint/shadcn chains. These are unresolved, not suppressed or fixed by the folder move. Do not run `npm audit fix --force` or downgrade major tooling solely to hide findings. Production builds still require development tooling in the build stage.

This is a local application, not a verified production deployment. Production operation needs TLS, controlled migrations/bootstrap provisioning, managed secrets/backups, rate limits, account recovery and appropriate observability/security testing. There is no token revocation service, immutable order ledger or server pagination. Profile editing/password recovery and notification feeds are unavailable. The frontend session helper decodes claims for presentation; the backend is the authoritative signature/role validation boundary.
