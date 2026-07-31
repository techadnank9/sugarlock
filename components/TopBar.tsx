import Link from 'next/link'
import { RolePill } from './RolePill'
import { GuestLogoutButton } from './GuestLogoutButton'

export function TopBar({
  role,
  userLabel,
  isGuest,
}: {
  role?: 'sender' | 'recipient' | 'confirmer'
  userLabel?: string
  isGuest?: boolean
}) {
  return (
    <header className="flex items-center justify-between border-b border-line px-6 py-4">
      <Link href="/" className="font-display text-xl text-paper">
        Sugarlock
      </Link>
      <div className="flex items-center gap-3">
        {userLabel && <span className="text-sm text-paper-dim">{userLabel}</span>}
        {role && <RolePill role={role} />}
        {userLabel ? (
          isGuest ? (
            <GuestLogoutButton />
          ) : (
            <a href="/auth/logout" className="text-sm text-paper-dim underline">
              Log out
            </a>
          )
        ) : (
          <a href="/auth/login" className="text-sm text-gold-soft underline">
            Log in
          </a>
        )}
      </div>
    </header>
  )
}
