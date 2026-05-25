import { z } from "zod"
import bcrypt from "bcryptjs"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/services/email.service"
import { welcomeTemplate } from "@/services/email/templates"

// ─── Validation schema ────────────────────────────────────────────────────────

export const registerSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
})

export type RegisterInput = z.infer<typeof registerSchema>

// ─── Typed errors ─────────────────────────────────────────────────────────────

export class DuplicateEmailError extends Error {
  constructor() {
    super("An account with that email already exists.")
    this.name = "DuplicateEmailError"
  }
}

export class RegistrationError extends Error {
  constructor() {
    super("Something went wrong. Please try again.")
    this.name = "RegistrationError"
  }
}

// ─── Service ─────────────────────────────────────────────────────────────────

export async function registerUser(
  input: RegisterInput
): Promise<{ id: string; email: string }> {
  // 1. Normalize email
  const email = input.email.trim().toLowerCase()
  const { password } = input

  // 2. Hash password at cost 12 — matches bcrypt usage in auth.ts Credentials provider
  const hashedPassword = await bcrypt.hash(password, 12)

  // 3. Tenant name defaults to email local-part (e.g. "alice" from "alice@example.com")
  const tenantName = email.split("@")[0]

  // 4. Atomic transaction: User + Tenant + TenantMember + Subscription
  let result: { id: string; email: string }

  try {
    result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          emailVerified: null,
        },
        select: { id: true, email: true },
      })

      const tenant = await tx.tenant.create({
        data: { name: tenantName },
        select: { id: true },
      })

      await tx.tenantMember.create({
        data: {
          userId: user.id,
          tenantId: tenant.id,
          role: "OWNER",
        },
      })

      await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          plan: "FREE",
          status: "ACTIVE",
        },
      })

      return { id: user.id, email: user.email! }
    })
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new DuplicateEmailError()
    }
    throw new RegistrationError()
  }

  // 5. Send welcome email after transaction commits.
  //    Any failure is swallowed — email queue failure must not affect registration.
  try {
    const { subject, html } = welcomeTemplate({
      name: tenantName,
      email: result.email,
    })
    await sendEmail({
      to: result.email,
      subject,
      template: html,
      variables: { name: tenantName, email: result.email },
    })
  } catch {
    // Intentionally swallowed
  }

  return result
}
