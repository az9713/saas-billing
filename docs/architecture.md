# Architecture

## Service Boundaries

This application is split into two main layers:

- **Next.js App Router frontend** — handles all UI, pages, and client-side logic
- **Node.js backend services** — handles business logic, external API calls, and background jobs

API routes in `app/api/` are thin entry points. They validate the incoming request, call a service function, and return the result. No business logic lives in a route handler.

## Request Flow

```
Client → Next.js API Route → Service → Prisma → PostgreSQL
                                     → Resend (email)
                                     → Stripe (billing)
                          → BullMQ Worker (async jobs)
```

## Tenant Isolation Model

This is a multi-tenant SaaS. Every database query that returns user-facing data must be scoped to the current tenant (company).

- Tenant isolation is enforced in the **service layer**, not in route handlers.
- Use the `requireSameTenant(userId, resourceId)` helper before any cross-tenant operation.
- Never return data from a different tenant, even for admins.
- Billing history and subscription data are scoped to the company account, not the individual user.

## Folder Structure

```
app/
  (admin)/        — admin-only pages and components
  api/            — API route handlers (thin)
services/         — business logic modules
workers/          — BullMQ background job workers
prisma/           — schema and migrations
docs/             — internal documentation
```
