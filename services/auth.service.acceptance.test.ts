/**
 * Acceptance tests for user registration — coverage of AC gaps not addressed
 * by the existing 16 unit tests.
 *
 * Gaps targeted:
 *   AC2  — password stored as bcrypt hash (cost 12), never plain text
 *   AC3  — TenantMember created with OWNER role, inside the same transaction
 *   AC5  — welcome email queued via sendEmail after transaction; failure swallowed
 *   AC12 — Subscription created with plan FREE and status ACTIVE
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { registerUser, DuplicateEmailError } from "./auth.service"
import { Prisma } from "@prisma/client"

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}))

vi.mock("@/services/email.service", () => ({
  sendEmail: vi.fn(),
}))

// Expose the real bcrypt spy so assertions on cost can be made.
// The default mock still makes hashing instant.
vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn(async (_pw: string, _rounds: number) => "hashed-bcrypt-value"),
  },
}))

import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/services/email.service"
import bcrypt from "bcryptjs"

// ─── Test data builders ───────────────────────────────────────────────────────

function buildRegisterInput(
  overrides?: Partial<{ email: string; password: string }>
) {
  return {
    email: "carol@example.com",
    password: "securepass1",
    ...overrides,
  }
}

function buildCreatedUser(
  overrides?: Partial<{ id: string; email: string }>
) {
  return {
    id: "user_accept_1",
    email: "carol@example.com",
    ...overrides,
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type FakeTx = {
  userCreateArgs: unknown
  tenantMemberCreateArgs: unknown
  subscriptionCreateArgs: unknown
}

/**
 * Sets up a successful prisma.$transaction call and captures every
 * prisma model create call's first argument so tests can assert on it.
 */
function setupTransactionCapture(
  user = buildCreatedUser()
): { captured: FakeTx } {
  const captured: FakeTx = {
    userCreateArgs: undefined,
    tenantMemberCreateArgs: undefined,
    subscriptionCreateArgs: undefined,
  }

  vi.mocked(prisma.$transaction).mockImplementationOnce(async (fn: unknown) => {
    if (typeof fn !== "function") return fn

    const tx = {
      user: {
        create: vi.fn().mockImplementation(async (args: unknown) => {
          captured.userCreateArgs = args
          return user
        }),
      },
      tenant: {
        create: vi.fn().mockResolvedValue({ id: "tenant_accept_1" }),
      },
      tenantMember: {
        create: vi.fn().mockImplementation(async (args: unknown) => {
          captured.tenantMemberCreateArgs = args
          return {}
        }),
      },
      subscription: {
        create: vi.fn().mockImplementation(async (args: unknown) => {
          captured.subscriptionCreateArgs = args
          return {}
        }),
      },
    }

    return fn(tx)
  })

  return { captured }
}

// ─── Acceptance tests ────────────────────────────────────────────────────────

describe("registerUser — acceptance criteria", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── AC2: password is hashed with bcrypt, never stored in plain text ──────────

  describe("AC2 — password stored as bcrypt hash, never plain text", () => {
    it("calls bcrypt.hash with cost factor 12", async () => {
      setupTransactionCapture()
      const input = buildRegisterInput({ password: "mypassword1" })

      await registerUser(input)

      expect(vi.mocked(bcrypt.hash)).toHaveBeenCalledOnce()
      const [, saltOrRounds] = vi.mocked(bcrypt.hash).mock.calls[0]
      expect(saltOrRounds).toBe(12)
    })

    it("persists the hashed value rather than the raw password", async () => {
      const { captured } = setupTransactionCapture()
      const input = buildRegisterInput({ password: "plaintextpassword" })

      await registerUser(input)

      const userArgs = captured.userCreateArgs as {
        data: { password: string }
      }
      // Must be the mocked hash return value, not the raw input
      expect(userArgs.data.password).toBe("hashed-bcrypt-value")
      expect(userArgs.data.password).not.toBe("plaintextpassword")
    })
  })

  // ── AC3: TenantMember is created with OWNER role inside the transaction ─────

  describe("AC3 — TenantMember linked to User with OWNER role, same transaction", () => {
    it("creates TenantMember with role OWNER", async () => {
      const { captured } = setupTransactionCapture()

      await registerUser(buildRegisterInput())

      const memberArgs = captured.tenantMemberCreateArgs as {
        data: { role: string; userId: string; tenantId: string }
      }
      expect(memberArgs.data.role).toBe("OWNER")
    })

    it("links TenantMember to the newly created user id", async () => {
      const user = buildCreatedUser({ id: "user_owner_test" })
      const { captured } = setupTransactionCapture(user)

      await registerUser(buildRegisterInput())

      const memberArgs = captured.tenantMemberCreateArgs as {
        data: { userId: string; tenantId: string; role: string }
      }
      expect(memberArgs.data.userId).toBe("user_owner_test")
    })

    it("links TenantMember to the newly created tenant id", async () => {
      const { captured } = setupTransactionCapture()

      // Override tenant creation to return a known id
      vi.mocked(prisma.$transaction).mockReset()
      vi.mocked(prisma.$transaction).mockImplementationOnce(
        async (fn: unknown) => {
          if (typeof fn !== "function") return fn
          const tx = {
            user: {
              create: vi.fn().mockResolvedValue(buildCreatedUser()),
            },
            tenant: {
              create: vi
                .fn()
                .mockResolvedValue({ id: "known_tenant_id" }),
            },
            tenantMember: {
              create: vi.fn().mockImplementation(async (args: unknown) => {
                captured.tenantMemberCreateArgs = args
                return {}
              }),
            },
            subscription: {
              create: vi.fn().mockResolvedValue({}),
            },
          }
          return fn(tx)
        }
      )

      await registerUser(buildRegisterInput())

      const memberArgs = captured.tenantMemberCreateArgs as {
        data: { userId: string; tenantId: string; role: string }
      }
      expect(memberArgs.data.tenantId).toBe("known_tenant_id")
    })
  })

  // ── AC5: welcome email queued via sendEmail after the transaction ────────────

  describe("AC5 — welcome email queued immediately after account creation", () => {
    it("calls sendEmail once with the welcome subject after a successful registration", async () => {
      setupTransactionCapture(buildCreatedUser({ email: "dave@example.com" }))
      vi.mocked(sendEmail).mockResolvedValueOnce(undefined as unknown as ReturnType<typeof sendEmail> extends Promise<infer T> ? T : never)

      await registerUser(buildRegisterInput({ email: "dave@example.com" }))

      expect(vi.mocked(sendEmail)).toHaveBeenCalledOnce()
      const callArg = vi.mocked(sendEmail).mock.calls[0][0]
      expect(callArg.to).toBe("dave@example.com")
      expect(callArg.subject).toMatch(/welcome/i)
    })

    it("queues the email to the registered address", async () => {
      setupTransactionCapture(buildCreatedUser({ email: "eve@example.com" }))

      await registerUser(
        buildRegisterInput({ email: "eve@example.com" })
      )

      const callArg = vi.mocked(sendEmail).mock.calls[0][0]
      expect(callArg.to).toBe("eve@example.com")
    })

    it("email queue failure does not cause registerUser to throw", async () => {
      setupTransactionCapture()
      vi.mocked(sendEmail).mockRejectedValueOnce(
        new Error("BullMQ Redis connection failed")
      )

      // Must resolve, not reject
      await expect(registerUser(buildRegisterInput())).resolves.toBeDefined()
    })

    it("returns the registration result even when sendEmail throws", async () => {
      const user = buildCreatedUser({ id: "user_email_fail" })
      setupTransactionCapture(user)
      vi.mocked(sendEmail).mockRejectedValueOnce(new Error("Queue offline"))

      const result = await registerUser(buildRegisterInput())

      expect(result).toEqual({ id: "user_email_fail", email: user.email })
    })
  })

  // ── AC12: Subscription created with plan FREE and status ACTIVE ──────────────

  describe("AC12 — new Tenant subscription defaults to FREE plan with ACTIVE status", () => {
    it("creates a Subscription with plan FREE", async () => {
      const { captured } = setupTransactionCapture()

      await registerUser(buildRegisterInput())

      const subArgs = captured.subscriptionCreateArgs as {
        data: { plan: string; status: string; tenantId: string }
      }
      expect(subArgs.data.plan).toBe("FREE")
    })

    it("creates a Subscription with status ACTIVE", async () => {
      const { captured } = setupTransactionCapture()

      await registerUser(buildRegisterInput())

      const subArgs = captured.subscriptionCreateArgs as {
        data: { plan: string; status: string; tenantId: string }
      }
      expect(subArgs.data.status).toBe("ACTIVE")
    })

    it("links the Subscription to the newly created tenant", async () => {
      // Use a controlled transaction to emit a known tenant id
      const captured: { subscriptionCreateArgs: unknown } = {
        subscriptionCreateArgs: undefined,
      }

      vi.mocked(prisma.$transaction).mockImplementationOnce(
        async (fn: unknown) => {
          if (typeof fn !== "function") return fn
          const tx = {
            user: {
              create: vi.fn().mockResolvedValue(buildCreatedUser()),
            },
            tenant: {
              create: vi
                .fn()
                .mockResolvedValue({ id: "sub_tenant_id" }),
            },
            tenantMember: {
              create: vi.fn().mockResolvedValue({}),
            },
            subscription: {
              create: vi.fn().mockImplementation(async (args: unknown) => {
                captured.subscriptionCreateArgs = args
                return {}
              }),
            },
          }
          return fn(tx)
        }
      )

      await registerUser(buildRegisterInput())

      const subArgs = captured.subscriptionCreateArgs as {
        data: { tenantId: string }
      }
      expect(subArgs.data.tenantId).toBe("sub_tenant_id")
    })
  })

  // ── AC10: No raw DB errors returned (service boundary) ──────────────────────
  // This was covered by the existing tests. Adding one edge case: a RegistrationError
  // message is safe and does not contain raw database text.

  describe("AC10 — raw database errors are not surfaced", () => {
    it("wraps unexpected errors as RegistrationError with a safe message", async () => {
      vi.mocked(prisma.$transaction).mockRejectedValueOnce(
        new Error("FATAL: connection to host db.internal:5432 refused")
      )

      const err = await registerUser(buildRegisterInput()).catch((e) => e)

      expect(err).toBeDefined()
      expect(err.message).toBe("Something went wrong. Please try again.")
      expect(err.message).not.toContain("5432")
      expect(err.message).not.toContain("connection to host")
    })
  })
})
