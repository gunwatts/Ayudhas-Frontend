# Frontend: Next.js static app

A static export (`output: "export"`) for GitHub Pages. All data is fetched client-side from `NEXT_PUBLIC_API_BASE_URL`, and nothing runs on a server.

| Task | Command |
|---|---|
| Develop | `npm run dev` (http://localhost:3000; the API defaults to http://localhost:8000) |
| Type-check, lint, unit tests | `npm run typecheck`, `npm run lint`, `npm test` |
| Production build | `NEXT_PUBLIC_API_BASE_URL=https://<api-host> npm run build`, which writes `out/` |
| End-to-end tests | `npm run test:e2e`. Needs the backend on :8000 and `out/` served on :3000; see `docs/06_TESTING.md`. |
| Refresh API types | `npm run gen:api` (from `../shared/openapi.json`) |

## Structure
- `src/app/(app)/…`: authenticated pages. Detail pages use query strings (`/loans/view/?id=1`) because a static export can't prerender per-user routes.
- `src/components/`: the app shell, forms, charts, lists, and shadcn/ui primitives in `ui/`.
- `src/lib/`:
  - `api.ts`: fetch client with credentials, the in-memory CSRF token, idempotency keys and typed errors
  - `queries.ts`: TanStack Query hooks. Every money mutation invalidates all finance queries, so dashboards refresh.
  - `money.ts`: decimal-safe helpers using integer paise via BigInt. These are for previews only; the server is authoritative.
