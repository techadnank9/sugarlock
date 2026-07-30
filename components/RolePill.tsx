export function RolePill({ role }: { role: 'sender' | 'recipient' | 'confirmer' }) {
  return (
    <span className="rounded-full border border-gold-dim px-3 py-1 text-xs uppercase tracking-wide text-gold-soft">
      {role}
    </span>
  )
}
