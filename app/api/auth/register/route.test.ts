import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { z } from "zod"

// ─── Hoisted definitions (available before vi.mock factory executes) ───────────

const { DuplicateEmailError, RegistrationError } = vi.hoisted(() => {
  class DuplicateEmailError extends Error {
    constructor() {
      super("An account with that email already exists.")
      this.name = "DuplicateEmailError"
    }
  }

  class RegistrationError extends Error {
    constructor() {
      super("Something went wrong. Please try again.")
      this.name = "RegistrationError"
    }
  }

  return { DuplicateEmailError, RegistrationError }
})

// ─── Mock the auth service module ─────────────────────────────────────────────

vi.mock("@/services/auth.service", () => ({
  registerSchema: z.object({
    email: z.string().email("Please enter a valid email address."),
    password: z.string().min(8, "Password must be at least 8 characters."),
  }),
  registerUser: vi.fn(),
  DuplicateEmailError,
  RegistrationError,
}))

// ─── Import route AFTER mocks are set up ─────────────────────────────────────

import { POST, resetRateLimiter } from "./route"
import { registerUser } from "@/services/auth.service"

// ─── Test data builder ────────────────────────────────────────────────────────

function buildValidBody(overrides?: Partial<{ email: string; password: string }>) {
  return {
    email: "bob@example.com",
    password: "securepassword",
    ...overrides,
  }
}

function makeRequest(body: unknown, ip = "1.2.3.4") {
  return new NextRequest("http://localhost/api/auth/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify(body),
  })
}

function makeRequestNoIp(body: unknown) {
  return new NextRequest("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetRateLimiter()
  })

  it("returns 201 with userId on valid input", async () => {
    vi.mocked(registerUser).mockResolvedValueOnce({ id: "user_abc", email: "bob@example.com" })

    const res = await POST(makeRequest(buildValidBody()))

    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json).toEqual({ userId: "user_abc" })
  })

  it("returns 400 when email field is missing", async () => {
    const res = await POST(makeRequest({ password: "securepassword" }))

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json).toHaveProperty("error")
    expect(typeof json.error).toBe("string")
  })

  it("returns 400 when password is shorter than 8 characters", async () => {
    const res = await POST(makeRequest(buildValidBody({ password: "short" })))

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/8 characters/i)
  })

  it("returns 409 with user-safe message when email is already registered", async () => {
    vi.mocked(registerUser).mockRejectedValueOnce(new DuplicateEmailError())

    const res = await POST(makeRequest(buildValidBody()))

    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json).toEqual({ error: "An account with that email already exists." })
  })

  it("returns 500 with generic message and no raw DB error on unexpected failure", async () => {
    vi.mocked(registerUser).mockRejectedValueOnce(new Error("connection to database refused"))

    const res = await POST(makeRequest(buildValidBody()))

    expect(res.status).toBe(500)
    const json = await res.json()
    // Must not expose raw DB error message
    expect(json.error).not.toContain("connection to database refused")
    expect(json.error).toBe("Something went wrong. Please try again.")
  })

  it("returns 429 on the 6th request from the same IP within the window", async () => {
    vi.mocked(registerUser).mockResolvedValue({ id: "user_abc", email: "bob@example.com" })

    const rateLimitedIp = "5.6.7.8"
    const body = buildValidBody()

    // First 5 requests should succeed
    for (let i = 0; i < 5; i++) {
      const res = await POST(makeRequest(body, rateLimitedIp))
      expect(res.status).toBe(201)
    }

    // 6th request must be blocked
    const res = await POST(makeRequest(body, rateLimitedIp))
    expect(res.status).toBe(429)
    const json = await res.json()
    expect(json).toEqual({ error: "Too many requests. Please try again." })

    // registerUser must NOT have been called on the blocked 6th request
    expect(vi.mocked(registerUser)).toHaveBeenCalledTimes(5)
  })

  it("returns 429 immediately when no IP header is present and does not call registerUser", async () => {
    const res = await POST(makeRequestNoIp(buildValidBody()))

    expect(res.status).toBe(429)
    const json = await res.json()
    expect(json).toEqual({ error: "Too many requests. Please try again." })
    expect(vi.mocked(registerUser)).not.toHaveBeenCalled()
  })
})
