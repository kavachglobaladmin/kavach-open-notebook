/**
 * Lightweight client-side JWT utility.
 *
 * We use the Web Crypto API (SubtleCrypto) to create HMAC-SHA256 signed tokens
 * that look and behave like real JWTs — header.payload.signature — but are
 * verified entirely in the browser.
 *
 * Why client-side?
 *   User accounts are stored in localStorage (no backend user DB), so the
 *   backend cannot issue user-specific tokens.  The backend only knows one
 *   shared password.  We layer a proper expiry mechanism on top of that.
 *
 * Token lifetime: tokens do NOT expire on their own. They are invalidated
 * only when the user explicitly logs out — logout rotates the browser secret,
 * making all previously issued tokens unverifiable.
 */

// ── Config ────────────────────────────────────────────────────────────────────

// SESSION_DURATION_MS kept for backward-compat but tokens are now non-expiring.
// Expiry is enforced by logout (secret rotation) rather than a time limit.
export const SESSION_DURATION_MS = Infinity

/**
 * A per-browser secret stored in localStorage.
 * Not a server secret — its purpose is to prevent trivial token forgery
 * within the same browser profile.
 *
 * Rotating this secret (on logout) instantly invalidates all previously
 * issued tokens because their signatures will no longer verify.
 */
function getBrowserSecret(): string {
  const KEY = 'kavach_browser_secret'
  let secret = localStorage.getItem(KEY)
  if (!secret) {
    secret = generateSecret()
    localStorage.setItem(KEY, secret)
  }
  return secret
}

function generateSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Rotate the browser secret, instantly invalidating all existing tokens.
 * Call this on logout.
 */
export function rotateBrowserSecret(): void {
  localStorage.setItem('kavach_browser_secret', generateSecret())
}

// ── Encoding helpers ──────────────────────────────────────────────────────────

function b64url(data: string): string {
  return btoa(data).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function fromB64url(s: string): string {
  return atob(s.replace(/-/g, '+').replace(/_/g, '/'))
}

async function hmacSign(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return b64url(String.fromCharCode(...new Uint8Array(sig)))
}

async function hmacVerify(secret: string, message: string, signature: string): Promise<boolean> {
  const expected = await hmacSign(secret, message)
  return expected === signature
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface KavachTokenPayload {
  sub: string        // email
  iat: number        // issued-at  (ms)
  exp: number        // expires-at (ms)
  name?: string
}

/**
 * Issue a signed JWT-like token for the given user.
 * The token has no practical expiry — it is invalidated only by logout
 * (which rotates the browser secret).
 */
export async function issueToken(email: string, name?: string): Promise<string> {
  const now = Date.now()
  const payload: KavachTokenPayload = {
    sub: email,
    iat: now,
    exp: now + 100 * 365 * 24 * 60 * 60 * 1000, // ~100 years — effectively no expiry
    ...(name ? { name } : {}),
  }

  const header  = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body    = b64url(JSON.stringify(payload))
  const secret  = getBrowserSecret()
  const sig     = await hmacSign(secret, `${header}.${body}`)

  return `${header}.${body}.${sig}`
}

/**
 * Verify and decode a token.
 * Returns the payload if valid and not expired, otherwise null.
 */
export async function verifyToken(token: string): Promise<KavachTokenPayload | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    const [header, body, sig] = parts
    const secret = getBrowserSecret()

    const valid = await hmacVerify(secret, `${header}.${body}`, sig)
    if (!valid) return null

    const payload: KavachTokenPayload = JSON.parse(fromB64url(body))

    if (Date.now() > payload.exp) return null   // expired

    return payload
  } catch {
    return null
  }
}

/**
 * Decode without verifying (safe for reading expiry UI).
 */
export function decodeToken(token: string): KavachTokenPayload | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    return JSON.parse(fromB64url(parts[1]))
  } catch {
    return null
  }
}

/**
 * Returns true if the token is expired (or invalid).
 */
export function isTokenExpired(token: string | null): boolean {
  if (!token || token === 'not-required') return false
  const payload = decodeToken(token)
  if (!payload) return true
  return Date.now() > payload.exp
}

/**
 * Returns milliseconds until the token expires (negative if already expired).
 */
export function msUntilExpiry(token: string | null): number {
  if (!token || token === 'not-required') return Infinity
  const payload = decodeToken(token)
  if (!payload) return -1
  return payload.exp - Date.now()
}
