'use client'

import { useRouter } from 'next/navigation'

export function GuestLogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/guest', { method: 'DELETE' })
    router.refresh()
  }

  return (
    <button onClick={handleLogout} className="text-sm text-paper-dim underline">
      Log out
    </button>
  )
}
