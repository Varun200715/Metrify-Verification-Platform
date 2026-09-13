# Metrify Verification Platform

Metrify is a full-stack digital verification platform for registering, inspecting, certifying, and publicly verifying measuring instruments.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/metrify run dev` — run the web app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Frontend: React + Vite + Tailwind CSS + Wouter

## Where things live

- `artifacts/metrify/src/App.tsx` — routed portal, officer, admin, citizen verification, and passport UI
- `artifacts/metrify/src/index.css` — Metrify visual system and responsive layout utilities
- `artifacts/api-server/src/routes/metrify.ts` — REST handlers, demo seeding, verification, risk, and certificate logic
- `lib/api-spec/openapi.yaml` — API source of truth
- `lib/db/src/schema/index.ts` — Drizzle schema source of truth

## Architecture decisions

- The web portal and officer field experience are one responsive React artifact with role-specific routes, so they share API hooks and public verification behavior.
- The API seeds fictional demo records lazily on first request, keeping first-run setup automatic while storing data in PostgreSQL.
- OCR is intentionally modeled as an assistive cross-check; PASS/FAIL remains an officer-submitted inspection result.
- QR verification exposes only instrument verification data and inspection history, not private owner contact details.

## Product

Business owners can register instruments and track applications. Officers can inspect assigned instruments with OCR/GPS assistance and an offline queue. Authorities can review metrics, risk signals, planning, and audit logs. Citizens can verify an instrument by ID or QR-style public URL and report issues.

## User preferences

No additional preferences recorded.

## Gotchas

- Demo credentials are business@metrify.demo, lmo@metrify.demo, and admin@metrify.demo with password Metrify@123.
- The API and web artifact are separate managed workflows; restart them by their exact workflow names.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details