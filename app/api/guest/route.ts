import { NextResponse } from 'next/server'
import { createGuestIdentity, signGuestToken, GUEST_COOKIE } from '@/lib/guest-session'

export async function POST() {
  const identity = createGuestIdentity()
  const token = await signGuestToken(identity)

  const res = NextResponse.json({ ok: true })
  res.cookies.set(GUEST_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete(GUEST_COOKIE)
  return res
}
