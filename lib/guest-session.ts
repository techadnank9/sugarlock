import { randomUUID } from 'crypto'
import { SignJWT, jwtVerify } from 'jose'

export const GUEST_COOKIE = 'sugarlock_guest'

export type GuestUser = { sub: string; email: string; name: string }

function secretKey(): Uint8Array {
  const secret = process.env.CONFIRM_TOKEN_SECRET
  if (!secret) throw new Error('CONFIRM_TOKEN_SECRET is not set')
  return new TextEncoder().encode(secret)
}

export function createGuestIdentity(): GuestUser {
  const id = randomUUID()
  return { sub: `guest:${id}`, email: `guest-${id}@sugarlock.demo`, name: 'Guest' }
}

export async function signGuestToken(user: GuestUser): Promise<string> {
  return new SignJWT(user).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('30d').sign(secretKey())
}

/** Verified server-side against CONFIRM_TOKEN_SECRET, so a tampered cookie
 * can't be used to impersonate a real sender/recipient/confirmer row. */
export async function verifyGuestToken(token: string): Promise<GuestUser | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey())
    if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') return null
    return { sub: payload.sub, email: payload.email, name: typeof payload.name === 'string' ? payload.name : 'Guest' }
  } catch {
    return null
  }
}
