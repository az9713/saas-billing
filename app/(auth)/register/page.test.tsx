// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom/vitest"

// ─── Module mocks (must appear before the component import) ───────────────────

const mockPush = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}))

const mockSignIn = vi.fn()
vi.mock("next-auth/react", () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
}))

// ─── Import component after mocks are hoisted ─────────────────────────────────

import RegisterPage from "./page"

// ─── Test data builder ────────────────────────────────────────────────────────

function buildFormInput(
  overrides?: Partial<{
    email: string
    password: string
    confirmPassword: string
  }>
) {
  return {
    email: "alice@example.com",
    password: "securepass",
    confirmPassword: "securepass",
    ...overrides,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeOkResponse(body: unknown, status: number) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    })
  )
}

async function fillAndSubmit(
  input: ReturnType<typeof buildFormInput>
) {
  await userEvent.type(screen.getByLabelText(/email address/i), input.email)
  await userEvent.type(screen.getByLabelText(/^password$/i), input.password)
  await userEvent.type(
    screen.getByLabelText(/confirm password/i),
    input.confirmPassword
  )
  await userEvent.click(screen.getByRole("button", { name: /create account/i }))
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("RegisterPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSignIn.mockResolvedValue({ ok: true })
    vi.stubGlobal("fetch", vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // 1. Password mismatch — client-side only, no network request
  it("shows inline error when passwords do not match and makes no network request", async () => {
    render(<RegisterPage />)

    await fillAndSubmit(
      buildFormInput({ password: "securepass", confirmPassword: "different1" })
    )

    expect(
      await screen.findByText(/passwords do not match/i)
    ).toBeInTheDocument()
    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
  })

  // 2. Password shorter than 8 characters — client-side only, no network request
  it("shows inline error when password is shorter than 8 characters and makes no network request", async () => {
    render(<RegisterPage />)

    await fillAndSubmit(
      buildFormInput({ password: "short", confirmPassword: "short" })
    )

    expect(
      await screen.findByText(/at least 8 characters/i)
    ).toBeInTheDocument()
    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
  })

  // 3. Malformed email — client-side only, no network request
  it("shows inline error for a malformed email address and makes no network request", async () => {
    render(<RegisterPage />)

    await fillAndSubmit(buildFormInput({ email: "not-an-email" }))

    expect(
      await screen.findByText(/valid email address/i)
    ).toBeInTheDocument()
    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
  })

  // 4. Successful 201 — calls signIn and redirects
  it("calls signIn and redirects to /dashboard on a 201 response", async () => {
    vi.mocked(fetch).mockReturnValueOnce(
      makeOkResponse({ userId: "user_xyz" }, 201)
    )

    render(<RegisterPage />)
    const input = buildFormInput()
    await fillAndSubmit(input)

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith("credentials", {
        email: input.email,
        password: input.password,
        redirect: false,
      })
    })
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/dashboard")
    })
  })

  // 5. 409 duplicate email — surface server error inline
  it("shows the duplicate-email error message on a 409 response", async () => {
    vi.mocked(fetch).mockReturnValueOnce(
      makeOkResponse(
        { error: "An account with that email already exists." },
        409
      )
    )

    render(<RegisterPage />)
    await fillAndSubmit(buildFormInput())

    expect(
      await screen.findByText(/an account with that email already exists/i)
    ).toBeInTheDocument()
    expect(mockSignIn).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
  })

  // 6. Double-submit prevention — second click while loading does nothing
  it("prevents double-submit: second click while loading does not trigger a second request", async () => {
    let resolveFirst!: (v: Response) => void
    const firstRequest = new Promise<Response>((resolve) => {
      resolveFirst = resolve
    })

    vi.mocked(fetch).mockReturnValueOnce(firstRequest)

    render(<RegisterPage />)
    await fillAndSubmit(buildFormInput())

    // Button should now be disabled while the first request is in-flight
    const submitButton = screen.getByRole("button", { name: /creating account/i })
    expect(submitButton).toBeDisabled()

    // Attempt a second click — should be a no-op because the button is disabled
    await userEvent.click(submitButton)

    // Only one fetch call should have been made
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1)

    // Resolve the first request so the component settles (avoids act() warnings)
    resolveFirst(
      new Response(JSON.stringify({ userId: "user_xyz" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      })
    )

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/dashboard"))
  })
})
