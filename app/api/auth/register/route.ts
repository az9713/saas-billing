import { NextRequest, NextResponse } from "next/server"
import {
  registerUser,
  registerSchema,
  DuplicateEmailError,
} from "@/services/auth.service"

// ─── In-memory rate limiter ───────────────────────────────────────────────────
// Sliding-window: allows up to RATE_LIMIT_MAX requests per RATE_LIMIT_WINDOW_MS
// per IP address. Entries are lazily pruned when a new request arrives from
// the same IP.
// Size cap: if the map exceeds MAX_MAP_SIZE entries, it is cleared entirely to
// prevent unbounded memory growth. This accepts brief amnesty for all IPs but
// keeps memory bounded without requiring an external cache or LRU library.

const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000 // 15 minutes
const MAX_MAP_SIZE = 10_000

const ipTimestamps = new Map<string, number[]>()

/** Clears all rate-limiter state. Exported for use in tests only. */
export function resetRateLimiter(): void {
  ipTimestamps.clear()
}

function isRateLimited(ip: string): boolean {
  if (ipTimestamps.size > MAX_MAP_SIZE) {
    ipTimestamps.clear()
  }
  const now = Date.now()
  const windowStart = now - RATE_LIMIT_WINDOW_MS
  const timestamps = (ipTimestamps.get(ip) ?? []).filter((t) => t > windowStart)
  if (timestamps.length >= RATE_LIMIT_MAX) {
    ipTimestamps.set(ip, timestamps)
    return true
  }
  timestamps.push(now)
  ipTimestamps.set(ip, timestamps)
  return false
}

function getClientIp(req: NextRequest): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null
  )
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  if (ip === null || isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again." },
      { status: 429 }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }

  const parsed = registerSchema.safeParse(body)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid input."
    return NextResponse.json({ error: message }, { status: 400 })
  }

  try {
    const { id } = await registerUser(parsed.data)
    return NextResponse.json({ userId: id }, { status: 201 })
  } catch (err) {
    if (err instanceof DuplicateEmailError) {
      return NextResponse.json({ error: err.message }, { status: 409 })
    }
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    )
  }
}
