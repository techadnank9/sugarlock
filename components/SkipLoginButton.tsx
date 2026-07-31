'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function SkipLoginButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleSkip() {
    setLoading(true)
    await fetch('/api/guest', { method: 'POST' })
    router.refresh()
  }

  return (
    <button onClick={handleSkip} disabled={loading} className="text-sm text-paper-dim underline disabled:opacity-60">
      {loading ? 'Entering…' : 'Skip login, browse as guest'}
    </button>
  )
}
