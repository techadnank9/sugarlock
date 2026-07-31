'use client'

import { use, useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { TopBar } from '@/components/TopBar'
import { GiftVessel } from '@/components/GiftVessel'
import { formatCents } from '@/lib/money'

type GiftStatus = 'draft' | 'funded' | 'locked' | 'unlocked' | 'released'

type GiftDetail = {
  id: string
  amountCents: number
  note: string | null
  status: GiftStatus
  sender: { displayName: string | null; email: string }
  recipient: { displayName: string | null; email: string }
  condition: { type: 'time' | 'self' | 'third_party' | 'data'; unlockAt: string | null } | null
}

export default function GiftDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ funded?: string }>
}) {
  const { id } = use(params)
  const { funded } = use(searchParams)

  const [data, setData] = useState<{ gift: GiftDetail; role: 'sender' | 'recipient' } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [withdrawing, setWithdrawing] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/gifts/${id}`)
    if (!res.ok) {
      setError((await res.json()).error ?? 'Could not load gift')
      return
    }
    setData(await res.json())
  }, [id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount
    load()
  }, [load])

  // Redirect-fallback for local/demo Stripe funding. The unlock condition is
  // evaluated server-side in GET /api/gifts/[id], so there is nothing to poll:
  // calling the cron endpoint from here used to loop forever whenever the gift
  // stayed `locked` (its own load() re-triggered this effect).
  useEffect(() => {
    if (!data) return
    if (funded === '1' && data.gift.status === 'draft') {
      fetch(`/api/gifts/${id}/confirm-funding`, { method: 'POST' }).then(load)
    }
  }, [data, funded, id, load])

  if (error) {
    return (
      <>
        <TopBar />
        <main className="flex flex-1 items-center justify-center px-6 text-paper-dim">{error}</main>
      </>
    )
  }

  if (!data) {
    return (
      <>
        <TopBar />
        <main className="flex flex-1 items-center justify-center px-6 text-paper-dim">Loading…</main>
      </>
    )
  }

  const { gift, role } = data
  const counterparty = role === 'sender' ? gift.recipient : gift.sender

  async function handleWithdraw() {
    setWithdrawing(true)
    const res = await fetch(`/api/gifts/${id}/withdraw`, { method: 'POST' })
    setWithdrawing(false)
    if (res.ok) load()
  }

  return (
    <>
      <TopBar role={role} />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center gap-8 px-6 py-14 text-center">
        <Link href="/" className="self-start text-sm text-paper-dim">
          &larr; Back
        </Link>

        <GiftVessel status={gift.status === 'released' ? 'released' : gift.status === 'unlocked' ? 'unlocked' : 'locked'} />

        <div>
          <p className="font-display text-5xl" style={{ color: gift.status === 'locked' || gift.status === 'draft' || gift.status === 'funded' ? 'var(--gold)' : 'var(--teal)' }}>
            {formatCents(gift.amountCents)}
          </p>
          <p className="mt-2 text-paper-dim">
            {role === 'sender' ? `To ${counterparty.displayName ?? counterparty.email}` : `From ${counterparty.displayName ?? counterparty.email}`}
          </p>
          {gift.note && <p className="mt-3 text-paper">&ldquo;{gift.note}&rdquo;</p>}
        </div>

        {gift.status === 'locked' && (
          <p className="font-display text-lg text-gold-soft">You can see it. You can&apos;t touch it yet.</p>
        )}

        {gift.condition?.type === 'time' && gift.condition.unlockAt && gift.status === 'locked' && (
          <p className="text-sm text-paper-dim">Unlocks {new Date(gift.condition.unlockAt).toLocaleString()}</p>
        )}
        {gift.condition?.type === 'third_party' && gift.status === 'locked' && (
          <p className="text-sm text-paper-dim">Waiting on a confirmer to approve.</p>
        )}

        {gift.status === 'unlocked' && role === 'recipient' && (
          <button
            onClick={handleWithdraw}
            disabled={withdrawing}
            className="rounded-control bg-teal px-6 py-3 font-medium text-ink disabled:opacity-60"
          >
            {withdrawing ? 'Withdrawing…' : `Withdraw ${formatCents(gift.amountCents)}`}
          </button>
        )}

        {gift.status === 'released' && <p className="text-teal">Withdrawn.</p>}
      </main>
    </>
  )
}
