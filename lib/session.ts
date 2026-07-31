import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import { auth0 } from './auth0'
import { GUEST_COOKIE, verifyGuestToken } from './guest-session'

export type SessionUser = { sub: string; email?: string; name?: string | null }

/** Login is optional: real Auth0 sessions take priority, falling back to a
 * signed guest cookie set by /api/guest so the app is usable without Auth0. */
export async function getAppSession(
  request?: NextRequest,
): Promise<{ user: SessionUser; isGuest: boolean } | null> {
  const real = request ? await auth0.getSession(request) : await auth0.getSession()
  if (real?.user) return { user: real.user, isGuest: false }

  const token = request ? request.cookies.get(GUEST_COOKIE)?.value : (await cookies()).get(GUEST_COOKIE)?.value
  if (!token) return null

  const guest = await verifyGuestToken(token)
  return guest ? { user: guest, isGuest: true } : null
}
