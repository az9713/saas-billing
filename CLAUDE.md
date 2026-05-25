# Project Instructions

This is a SaaS billing application.

## Stack

- Next.js 14 (App Router) with TypeScript
- Node.js services for billing and email
- Prisma + PostgreSQL
- Auth.js for authentication
- Resend for transactional email
- BullMQ for background jobs

## Commands

- `npm run dev` — start the dev server
- `npm test` — run unit tests
- `npm run typecheck` — type-check the project
- `npm run lint` — lint the project
- `npx prisma migrate dev` — run migrations locally

## Architecture

- Business logic lives in services or domain modules.
- API routes stay thin and call into services.
- Use the existing email template system; do not add a new one.
- The BullMQ worker handles all scheduled jobs. Do not add cron.
- Tenant isolation is enforced at the service layer, not the route.

## Documentation

For deeper context, consult these before guessing:

- `docs/architecture.md` — service boundaries, request flow, tenant isolation model
- `docs/billing.md` — Stripe webhook handling, invoice lifecycle, proration rules
- `docs/email.md` — template system, Resend setup, list of available templates
- `docs/jobs.md` — BullMQ queue names, job patterns, retry/backoff policy
- `docs/db.md` — schema conventions, tenant isolation patterns, soft-delete rules
- `docs/runbooks/` — production incident runbooks
- `prisma/schema.prisma` — source of truth for the data model
- ADRs in `docs/adr/` — past architecture decisions; read before contradicting one

For Next.js, Prisma, Auth.js, BullMQ, or Resend specifics, check the official docs rather than guessing.

## Testing

- Every feature has success, validation failure, and not-found tests.
- Use test data builders, not inline setup objects.
- Do not mock the database unless existing tests do.

## Don't do

- Do not log raw payment payloads.
- Do not return database errors directly to the client.
- Do not edit migrations after they have been merged.
