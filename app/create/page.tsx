'use client'

import { useState } from 'react'
import Link from 'next/link'
import { TopBar } from '@/components/TopBar'

type ConditionType = 'time' | 'self' | 'third_party' | 'data'

export default function CreateGiftPage() {
  const [amount, setAmount] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [note, setNote] = useState('')
  const [conditionType, setConditionType] = useState<ConditionType>('time')
  const [unlockAt, setUnlockAt] = useState('')
  const [confirmerEmail, setConfirmerEmail] = useState('')
  const [confirmerLabel, setConfirmerLabel] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const amountCents = Math.round(parseFloat(amount) * 100)
      const conditionParams =
        conditionType === 'time'
          ? { unlockAt }
          : conditionType === 'third_party'
            ? { confirmerEmail, label: confirmerLabel }
            : {}

      const giftRes = await fetch('/api/gifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountCents, recipientEmail, note, conditionType, conditionParams }),
      })
      if (!giftRes.ok) throw new Error((await giftRes.json()).error ?? 'Could not create gift')
      const { gift } = await giftRes.json()

      const checkoutRes = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ giftId: gift.id }),
      })
      if (!checkoutRes.ok) throw new Error((await checkoutRes.json()).error ?? 'Could not start checkout')
      const { url } = await checkoutRes.json()

      window.location.href = url
    } catch (err) {
      setError((err as Error).message)
      setSubmitting(false)
    }
  }

  return (
    <>
      <TopBar />
      <main className="mx-auto w-full max-w-lg flex-1 px-6 py-10">
        <Link href="/" className="mb-6 inline-block text-sm text-paper-dim">
          &larr; Back
        </Link>
        <h1 className="mb-6 font-display text-3xl">Create a gift</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-paper-dim">Amount (USD)</span>
            <input
              required
              type="number"
              min="1"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="rounded-control border border-line bg-ink-soft px-4 py-3 font-display text-xl text-paper outline-none focus:border-gold"
              placeholder="500.00"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-paper-dim">Recipient email</span>
            <input
              required
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              className="rounded-control border border-line bg-ink-soft px-4 py-3 text-paper outline-none focus:border-gold"
              placeholder="amara@example.com"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-paper-dim">Note</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="rounded-control border border-line bg-ink-soft px-4 py-3 text-paper outline-none focus:border-gold"
              placeholder="For your graduation"
              rows={2}
            />
          </label>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm text-paper-dim">Unlock condition</legend>
            <div className="flex flex-wrap gap-2">
              {(['time', 'third_party', 'self', 'data'] as ConditionType[]).map((type) => (
                <button
                  type="button"
                  key={type}
                  onClick={() => setConditionType(type)}
                  className={`rounded-control border px-4 py-2 text-sm capitalize ${
                    conditionType === type
                      ? 'border-gold bg-gold text-ink'
                      : 'border-line text-paper-dim hover:border-line-strong'
                  }`}
                >
                  {type.replace('_', ' ')}
                </button>
              ))}
            </div>
          </fieldset>

          {conditionType === 'time' && (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-paper-dim">Unlocks on</span>
              <input
                required
                type="datetime-local"
                value={unlockAt}
                onChange={(e) => setUnlockAt(e.target.value)}
                className="rounded-control border border-line bg-ink-soft px-4 py-3 text-paper outline-none focus:border-gold"
              />
            </label>
          )}

          {conditionType === 'third_party' && (
            <>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm text-paper-dim">Confirmer email</span>
                <input
                  required
                  type="email"
                  value={confirmerEmail}
                  onChange={(e) => setConfirmerEmail(e.target.value)}
                  className="rounded-control border border-line bg-ink-soft px-4 py-3 text-paper outline-none focus:border-gold"
                  placeholder="teacher@school.edu"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm text-paper-dim">What are they confirming?</span>
                <input
                  required
                  value={confirmerLabel}
                  onChange={(e) => setConfirmerLabel(e.target.value)}
                  className="rounded-control border border-line bg-ink-soft px-4 py-3 text-paper outline-none focus:border-gold"
                  placeholder="Amara graduated"
                />
              </label>
            </>
          )}

          {(conditionType === 'self' || conditionType === 'data') && (
            <p className="text-sm text-paper-dim">
              {conditionType === 'self'
                ? 'The recipient marks this done from their gift screen.'
                : 'Stretch goal — unlocks on an external signal, stubbed for the demo.'}
            </p>
          )}

          {error && <p className="text-sm text-paper-dim">Error: {error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="rounded-control bg-gold px-6 py-3 font-medium text-ink disabled:opacity-60"
          >
            {submitting ? 'Sealing…' : 'Fund & seal'}
          </button>
        </form>
      </main>
    </>
  )
}
