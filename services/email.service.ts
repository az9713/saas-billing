import { emailQueue } from "@/queues/email.queue"
import type { EmailJobData } from "@/queues/email.queue"

export async function sendEmail(data: EmailJobData) {
  return emailQueue.add("send", data)
}
