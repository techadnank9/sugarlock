'use client'

import { use, useEffect, useState } from 'react'
import { TopBar } from '@/components/TopBar'

type ConfirmData = {
  note: string | null
  recipientDisplayName: string
  label: string | null
  decision: 'pending' | 'approved' | 'declined'
}

export default function ConfirmPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [data, setData] = useState<ConfirmData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function load() {
    const res = await fetch(`/api/confirm/${token}`)
    if (!res.ok) {
      setError((await res.json()).error ?? 'This invite link is invalid or expired.')
      return
    }
    setData(await res.json())
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  async function decide(decision: 'approved' | 'declined') {
    setSubmitting(true)
    const res = await fetch(`/api/confirm/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision }),
    })
    setSubmitting(false)
    if (res.status === 401) {
      window.location.href = `/auth/login?returnTo=/confirm/${token}`
      return
    }
    if (res.ok) load()
  }

  return (
    <>
      <TopBar role="confirmer" />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-6 py-14 text-center">
        {error && <p className="text-paper-dim">{error}</p>}

        {!error && !data && <p className="text-paper-dim">Loading…</p>}

        {data && data.decision === 'pending' && (
          <>
            <h1 className="font-display text-2xl">
              {data.label ?? `Confirm this for ${data.recipientDisplayName}?`}
            </h1>
            {data.note && <p className="text-paper-dim">&ldquo;{data.note}&rdquo;</p>}
            <p className="text-sm text-paper-dim">
              This is the only decision you can make here — you won&apos;t see the amount or any other gift.
            </p>
            <div className="flex w-full gap-3">
              <button
                onClick={() => decide('declined')}
                disabled={submitting}
                className="flex-1 rounded-control border border-line px-6 py-3 font-medium text-paper disabled:opacity-60"
              >
                Not yet
              </button>
              <button
                onClick={() => decide('approved')}
                disabled={submitting}
                className="flex-1 rounded-control bg-teal px-6 py-3 font-medium text-ink disabled:opacity-60"
              >
                Confirm
              </button>
            </div>
          </>
        )}

        {data && data.decision === 'approved' && <p className="font-display text-2xl text-teal">Confirmed. The gift is unlocking.</p>}
        {data && data.decision === 'declined' && <p className="font-display text-2xl text-gold-soft">You marked this not confirmed.</p>}
      </main>
    </>
  )
}
