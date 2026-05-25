# Billing

## Stripe Webhook Handling

Webhooks arrive at `app/api/webhooks/stripe/route.ts`. Each event type is handled by a dedicated function in `services/billing/`.

Always verify the Stripe signature before processing any webhook payload. Never log raw payment payloads.

## Invoice Lifecycle

```
created → sent → paid
               → overdue (> payment terms)
               → void
```

Status is stored on the `Invoice` model in `prisma/schema.prisma`.

## Proration Rules

- Upgrades are prorated immediately.
- Downgrades take effect at the end of the current billing period.
- Cancelled subscriptions remain active until the end of the billing period.

## Reminder Columns Convention

Reminder-related timestamps follow the pattern `last<Action>SentAt`.
Example: `lastReminderSentAt` on the `Invoice` model.
