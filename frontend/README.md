# LMS Frontend (Phase 2)

Next.js 16 (App Router) + React 19 + TypeScript (strict) + Tailwind v4 + TanStack Query + React Hook Form/Zod + React Three Fiber.
Arabic-first (RTL) with an English locale. The UI talks to the Phase 1 NestJS API through a same-origin proxy.

## Run
```bash
cd frontend
cp .env.example .env.local        # API_INTERNAL_URL=http://localhost:3001
npm ci
npm run dev                        # http://localhost:3000
```
Backend must be running (`npm run start:dev` in the repo root, port 3001) and `CORS_ORIGINS` must contain `http://localhost:3000`
(the browser's `Origin` header is checked by the API's CSRF guard even though requests are proxied).

## Scripts
| Script | Purpose |
|---|---|
| `npm run typecheck` / `lint` / `test` / `build` | quality gates |
| `npm run smoke` | live check against a running stack (`SMOKE_PASSWORD=<seed password>`) |
| `npx playwright test` | browser E2E (see "Status" – work in progress) |

## Architecture
- `src/app` routes: `(public)` home/catalog/course detail, `(auth)` login/register/forgot/reset, `(app)` student / learn / instructor / admin / profile.
- `src/proxy.ts` (Next 16 "proxy" = former middleware): UX-only redirect to `/login?next=` when no session cookie. **Authorization is always enforced by the API.**
- `next.config.ts`: `/api/v1/*` rewrite to `API_INTERNAL_URL`, security headers + CSP.
- `src/lib/api`: typed client (timeout, GET retry, CSRF header from memory, 401 handler, error normalisation), endpoint functions, error-key mapping (backend English message -> localised text; raw server text is never shown).
- `src/i18n`: `ar.ts` is the source dictionary; `en.ts` is type-checked for completeness. Cookie `lms_locale`.
- `src/components/ui`: accessible primitives (native `<dialog>` modal, roving-tabindex tabs, responsive DataTable, etc.).
- 3D: `components/three/hero-scene.tsx` (lazy, loop stops when off-screen/hidden; static SVG fallback for no-WebGL and `prefers-reduced-motion`).

## Status (honest)
Verified: `tsc` clean, ESLint clean, 51 Vitest tests, `next build` OK, live smoke 87/87 against real API+DB (before the last `/auth/me` fix; API unchanged).
**Not finished**: Playwright suite is partial/not green; no visual review in a real browser; no dark mode; Phase 3 items (OpenAPI-generated types, full E2E, perf budget, deployment) are open. See `PROJECT_MASTER_DOCUMENT.md` (repo root) for the full list.
