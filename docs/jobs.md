# Background Jobs

## BullMQ Setup

All scheduled and async jobs run through BullMQ. The Redis connection is exported from `workers/redis.ts` as `redisConnection`.

Do not add a separate cron scheduler. If a job needs to run on a schedule, register it as a BullMQ repeatable job.

## Queue Names

| Queue name       | Purpose                                 |
|------------------|-----------------------------------------|
| `reminders`      | Invoice overdue reminder emails         |
| `email`          | General outbound email dispatch         |
| `webhooks`       | Outbound webhook delivery to customers  |

## Job Patterns

Each worker file in `workers/` exports a BullMQ `Worker` instance and a `Queue` instance. Producers import the queue. Consumers import the worker.

## Retry / Backoff Policy

- Default: 3 retries with exponential backoff (1s, 5s, 25s).
- For email jobs: 5 retries, backoff starts at 10s.
- Failed jobs after all retries are moved to the dead-letter queue and logged.

## Deduplication

Use database columns (e.g., `lastReminderSentAt`) for deduplication, not in-memory state. In-memory state is lost on restart and is not shared across multiple worker instances.
