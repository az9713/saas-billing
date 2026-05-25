# Database

## Schema Conventions

The source of truth for the data model is `prisma/schema.prisma`.

- Model names are PascalCase singular (`Invoice`, `Company`, `User`).
- Field names are camelCase.
- Timestamps: every model has `createdAt` and `updatedAt` managed by Prisma.
- Soft delete: use a `deletedAt DateTime?` field rather than hard-deleting rows.

## Tenant Isolation Patterns

Every table that contains tenant-scoped data includes a `companyId` foreign key. Always filter by `companyId` in service-layer queries. Never skip this filter for admin endpoints — admins are scoped to their own company.

## Soft-Delete Rules

- Do not hard-delete records that have billing or audit significance.
- Soft-deleted records should be excluded from all user-facing queries.
- Add a `where: { deletedAt: null }` clause by default.

## Migration Rules

- Never edit a migration file after it has been merged to main.
- Name migrations descriptively: `20240512_add_last_reminder_sent_at_to_invoices`.
- Run `npx prisma migrate dev` locally. CI runs `npx prisma migrate deploy`.
