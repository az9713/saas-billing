import { Worker } from "bullmq"
import { redis } from "@/lib/redis"
import { resend } from "@/lib/resend"
import type { EmailJobData } from "@/queues/email.queue"

export const emailWorker = new Worker<EmailJobData>(
  "email",
  async (job) => {
    const { to, subject, template, variables } = job.data
    // Template rendering plugs in here — see docs/email.md
    const html = renderTemplate(template, variables)
    await resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to,
      subject,
      html,
    })
  },
  {
    connection: redis,
    concurrency: 5,
  }
)

emailWorker.on("failed", (job, err) => {
  console.error(`[email-worker] job ${job?.id} failed:`, err.message)
})

function renderTemplate(template: string, variables: Record<string, string>): string {
  // Replace {{key}} placeholders — swap this for a real template engine later
  return Object.entries(variables).reduce(
    (html, [key, value]) => html.replaceAll(`{{${key}}}`, value),
    template
  )
}
