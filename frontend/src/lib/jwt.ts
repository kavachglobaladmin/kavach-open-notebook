/**
 * Lightweight client-side JWT utility.
 *
 * Uses SubtleCrypto when available (HTTPS / localhost), and falls back to a
 * pure-JS HMAC-SHA256 implementation so the app works over plain HTTP on
 * local network addresses (e.g. http://192.168.x.x:3000).
 *
 * Token lifetime: tokens do NOT expire on their own. They are invalidated
 * only when the user explicitly logs out — logout rotates the browser secret,
 * making all previously issued tokens unverifiable.
 */

export const SESSION_DURATION_MS = Infinity

// ── Browser secret ────────────────────────────────────────────────────────────

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
  // Try crypto.getRandomValues (available in most contexts)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = crypto.getRandomValues(new Uint8Array(32))
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
  }
  // Fallback for very old browsers or insecure contexts
  let hex = ''
  for (let i = 0; i < 32; i++) {
    hex += Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
  }
  return hex
}

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

// ── Pure-JS SHA-256 (RFC 6234) — used when SubtleCrypto is unavailable ────────

function sha256(data: Uint8Array): Uint8Array {
  // Initial hash values (first 32 bits of fractional parts of sqrt of primes 2..19)
  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ])
  // Round constants
  const K = new Uint32Array([
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
  ])

  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n))

  // Pre-processing: padding
  const msgLen = data.length
  const bitLen = msgLen * 8
  const padLen = ((msgLen + 9 + 63) & ~63)
  const padded = new Uint8Array(padLen)
  padded.set(data)
  padded[msgLen] = 0x80
  const view = new DataView(padded.buffer)
  view.setUint32(padLen - 4, bitLen >>> 0, false)
  view.setUint32(padLen - 8, Math.floor(bitLen / 0x100000000), false)

  // Process each 512-bit chunk
  for (let i = 0; i < padLen; i += 64) {
    const W = new Uint32Array(64)
    for (let t = 0; t < 16; t++) W[t] = view.getUint32(i + t * 4, false)
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(W[t-15], 7) ^ rotr(W[t-15], 18) ^ (W[t-15] >>> 3)
      const s1 = rotr(W[t-2], 17) ^ rotr(W[t-2], 19)  ^ (W[t-2] >>> 10)
      W[t] = (W[t-16] + s0 + W[t-7] + s1) >>> 0
    }
    let [a, b, c, d, e, f, g, h] = H
    for (let t = 0; t < 64; t++) {
      const S1   = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
      const ch   = (e & f) ^ (~e & g)
      const temp1 = (h + S1 + ch + K[t] + W[t]) >>> 0
      const S0   = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
      const maj  = (a & b) ^ (a & c) ^ (b & c)
      const temp2 = (S0 + maj) >>> 0
      h = g; g = f; f = e; e = (d + temp1) >>> 0
      d = c; c = b; b = a; a = (temp1 + temp2) >>> 0
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0
    H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0
    H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0
  }

  const result = new Uint8Array(32)
  const rv = new DataView(result.buffer)
  H.forEach((v, i) => rv.setUint32(i * 4, v, false))
  return result
}

function hmacSha256Fallback(keyStr: string, msgStr: string): Uint8Array {
  const enc = new TextEncoder()
  let key = enc.encode(keyStr)
  if (key.length > 64) key = sha256(key)

  const ipad = new Uint8Array(64)
  const opad = new Uint8Array(64)
  for (let i = 0; i < 64; i++) {
    ipad[i] = (key[i] ?? 0) ^ 0x36
    opad[i] = (key[i] ?? 0) ^ 0x5c
  }

  const msg = enc.encode(msgStr)
  const inner = new Uint8Array(64 + msg.length)
  inner.set(ipad); inner.set(msg, 64)

  const innerHash = sha256(inner)
  const outer = new Uint8Array(64 + 32)
  outer.set(opad); outer.set(innerHash, 64)

  return sha256(outer)
}

// ── HMAC sign/verify (SubtleCrypto when available, pure-JS fallback) ──────────

async function hmacSign(secret: string, message: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const enc = new TextEncoder()
      const key = await crypto.subtle.importKey(
        'raw', enc.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
      )
      const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
      return b64url(String.fromCharCode(...new Uint8Array(sig)))
    } catch { /* fall through to pure-JS */ }
  }
  // Pure-JS fallback for HTTP (non-secure) contexts
  const sig = hmacSha256Fallback(secret, message)
  return b64url(String.fromCharCode(...sig))
}

async function hmacVerify(secret: string, message: string, signature: string): Promise<boolean> {
  const expected = await hmacSign(secret, message)
  return expected === signature
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface KavachTokenPayload {
  sub: string
  iat: number
  exp: number
  name?: string
}

export async function issueToken(email: string, name?: string): Promise<string> {
  const now = Date.now()
  const payload: KavachTokenPayload = {
    sub: email,
    iat: now,
    exp: now + 100 * 365 * 24 * 60 * 60 * 1000,
    ...(name ? { name } : {}),
  }

  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body   = b64url(JSON.stringify(payload))
  const secret = getBrowserSecret()
  const sig    = await hmacSign(secret, `${header}.${body}`)

  return `${header}.${body}.${sig}`
}

export async function verifyToken(token: string): Promise<KavachTokenPayload | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const [header, body, sig] = parts
    const secret = getBrowserSecret()
    const valid = await hmacVerify(secret, `${header}.${body}`, sig)
    if (!valid) return null
    const payload: KavachTokenPayload = JSON.parse(fromB64url(body))
    if (Date.now() > payload.exp) return null
    return payload
  } catch {
    return null
  }
}

export function decodeToken(token: string): KavachTokenPayload | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    return JSON.parse(fromB64url(parts[1]))
  } catch {
    return null
  }
}

export function isTokenExpired(token: string | null): boolean {
  if (!token || token === 'not-required') return false
  const payload = decodeToken(token)
  if (!payload) return true
  return Date.now() > payload.exp
}

export function msUntilExpiry(token: string | null): number {
  if (!token || token === 'not-required') return Infinity
  const payload = decodeToken(token)
  if (!payload) return -1
  return payload.exp - Date.now()
}
