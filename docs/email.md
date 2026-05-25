# Email

## Template System

All transactional emails are sent through `services/email/send.ts` using Resend.

Do not create a new email-sending mechanism. Always use the existing `sendEmail` helper.

## Resend Setup

Resend is configured via the `RESEND_API_KEY` environment variable. The sender address is configured in `services/email/config.ts`.

## Available Templates

Templates live in `services/email/templates/`. Each template is a typed function that returns a subject and HTML body.

| Template key         | Description                        |
|----------------------|------------------------------------|
| `invoice-reminder`   | Reminder for overdue invoices      |
| `invoice-created`    | Notification when invoice is issued|
| `payment-received`   | Confirmation when payment is made  |
| `welcome`            | Sent on account creation           |

To add a new template, add a file to `services/email/templates/` and export it from the index.
