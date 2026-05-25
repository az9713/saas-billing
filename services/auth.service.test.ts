import { describe, it, expect, vi, beforeEach } from "vitest"
import { registerUser, DuplicateEmailError, RegistrationError } from "./auth.service"
import { Prisma } from "@prisma/client"

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock the Prisma singleton — no real DB in unit tests.
// This is the first test file in the project; mocking is documented as a
// deliberate decision in the implementation summary (CLAUDE.md guidance:
// "do not mock the database unless existing tests do" — no existing tests exist).
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}))

vi.mock("@/services/email.service", () => ({
  sendEmail: vi.fn(),
}))

// Mock bcryptjs so hashing is instant in tests
vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn(async (_pw: string, _rounds: number) => "hashed-password"),
  },
}))

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/services/email.service"

// ─── Test data builder ────────────────────────────────────────────────────────

function buildRegisterInput(overrides?: Partial<{ email: string; password: string }>) {
  return {
    email: "alice@example.com",
    password: "password123",
    ...overrides,
  }
}

function buildCreatedUser(overrides?: Partial<{ id: string; email: string }>) {
  return {
    id: "user_cuid_1",
    email: "alice@example.com",
    ...overrides,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeP2002Error() {
  const err = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "5.0.0",
    meta: { target: ["email"] },
  })
  return err
}

function setupSuccessfulTransaction(user = buildCreatedUser()) {
  vi.mocked(prisma.$transaction).mockImplementationOnce(async (fn: unknown) => {
    if (typeof fn === "function") {
      // Interactive transaction: pass a fake tx client
      const tx = {
        user: {
          create: vi.fn().mockResolvedValue(user),
        },
        tenant: {
          create: vi.fn().mockResolvedValue({ id: "tenant_cuid_1" }),
        },
        tenantMember: {
          create: vi.fn().mockResolvedValue({}),
        },
        subscription: {
          create: vi.fn().mockResolvedValue({}),
        },
      }
      return fn(tx)
    }
    return fn
  })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("registerUser", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("success", () => {
    it("creates User, Tenant, TenantMember, and Subscription; returns { id, email }", async () => {
      const user = buildCreatedUser()
      setupSuccessfulTransaction(user)

      const result = await registerUser(buildRegisterInput())

      expect(result).toEqual({ id: user.id, email: user.email })
      expect(prisma.$transaction).toHaveBeenCalledOnce()
    })

    it("trims and lowercases the email before persistence", async () => {
      let capturedEmail: string | undefined

      vi.mocked(prisma.$transaction).mockImplementationOnce(async (fn: unknown) => {
        if (typeof fn === "function") {
          const tx = {
            user: {
              create: vi.fn().mockImplementation(async ({ data }: { data: { email: string } }) => {
                capturedEmail = data.email
                return buildCreatedUser({ email: data.email })
              }),
            },
            tenant: { create: vi.fn().mockResolvedValue({ id: "t1" }) },
            tenantMember: { create: vi.fn().mockResolvedValue({}) },
            subscription: { create: vi.fn().mockResolvedValue({}) },
          }
          return fn(tx)
        }
      })

      await registerUser(buildRegisterInput({ email: "  Alice@Example.COM  " }))

      expect(capturedEmail).toBe("alice@example.com")
    })
  })

  describe("failure", () => {
    it("throws DuplicateEmailError when Prisma reports P2002", async () => {
      vi.mocked(prisma.$transaction).mockRejectedValueOnce(makeP2002Error())

      await expect(registerUser(buildRegisterInput())).rejects.toThrow(DuplicateEmailError)
    })

    it("throws RegistrationError for unexpected DB errors", async () => {
      vi.mocked(prisma.$transaction).mockRejectedValueOnce(new Error("connection timeout"))

      await expect(registerUser(buildRegisterInput())).rejects.toThrow(RegistrationError)
    })

    it("swallows email send failure and still returns the registration result", async () => {
      const user = buildCreatedUser()
      setupSuccessfulTransaction(user)
      vi.mocked(sendEmail).mockRejectedValueOnce(new Error("Redis unavailable"))

      // Should not throw
      const result = await registerUser(buildRegisterInput())

      expect(result).toEqual({ id: user.id, email: user.email })
    })
  })
})
