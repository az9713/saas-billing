import { Queue } from "bullmq"
import { redis } from "@/lib/redis"

export type EmailJobData = {
  to: string
  subject: string
  template: string
  variables: Record<string, string>
}

export const emailQueue = new Queue<EmailJobData>("email", {
  connection: redis,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 10000 },
  },
})
