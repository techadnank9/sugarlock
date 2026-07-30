import { formatCents } from '@/lib/money'

type GiftCardProps = {
  id: string
  amountCents: number
  status: 'draft' | 'funded' | 'locked' | 'unlocked' | 'released'
  note: string | null
  counterpartyLabel: string
  role: 'sender' | 'recipient'
}

const STATE_CLASS: Record<GiftCardProps['status'], string> = {
  draft: 'is-locked',
  funded: 'is-locked',
  locked: 'is-locked',
  unlocked: 'is-unlocked',
  released: 'is-unlocked',
}

export function GiftCard({ id, amountCents, status, note, counterpartyLabel, role }: GiftCardProps) {
  return (
    <a
      href={`/gift/${id}`}
      className={`block rounded-card border border-line bg-ink-card px-5 py-4 transition hover:border-line-strong ${STATE_CLASS[status]}`}
    >
      <div className="flex items-center justify-between">
        <span className="font-display text-2xl" style={{ color: 'var(--state)' }}>
          {formatCents(amountCents)}
        </span>
        <span className="text-xs uppercase tracking-wide text-paper-dim">{status}</span>
      </div>
      <p className="mt-1 text-sm text-paper-dim">
        {role === 'sender' ? `To ${counterpartyLabel}` : `From ${counterpartyLabel}`}
      </p>
      {note && <p className="mt-2 text-sm text-paper">{note}</p>}
    </a>
  )
}
