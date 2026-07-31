import { prisma } from '@/lib/prisma'
import { upsertUserForSession } from '@/lib/users'
import { getAppSession } from '@/lib/session'
import { TopBar } from '@/components/TopBar'
import { GiftCard } from '@/components/GiftCard'
import { SkipLoginButton } from '@/components/SkipLoginButton'

export default async function Home() {
  const session = await getAppSession()

  if (!session?.user) {
    return (
      <>
        <TopBar />
        <main className="mx-auto flex max-w-xl flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
          <h1 className="font-display text-4xl">Sugarlock</h1>
          <p className="text-paper-dim">
            Send money that unlocks only when a chosen condition is met. You can see it. You can&apos;t touch it yet.
          </p>
          <a href="/auth/login" className="rounded-control bg-gold px-6 py-3 font-medium text-ink">
            Log in to get started
          </a>
          <SkipLoginButton />
        </main>
      </>
    )
  }

  const user = await upsertUserForSession(session.user)

  const [sent, received] = await Promise.all([
    prisma.gift.findMany({ where: { senderId: user.id }, include: { recipient: true }, orderBy: { createdAt: 'desc' } }),
    prisma.gift.findMany({ where: { recipientId: user.id }, include: { sender: true }, orderBy: { createdAt: 'desc' } }),
  ])

  return (
    <>
      <TopBar
        role="sender"
        userLabel={session.user.name ?? session.user.email ?? undefined}
        isGuest={session.isGuest}
      />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="font-display text-3xl">Your gifts</h1>
          <a href="/create" className="rounded-control bg-gold px-5 py-2.5 font-medium text-ink">
            Create a gift
          </a>
        </div>

        <section className="mb-10">
          <h2 className="mb-3 text-sm uppercase tracking-wide text-paper-dim">Sent</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {sent.map((gift) => (
              <GiftCard
                key={gift.id}
                id={gift.id}
                amountCents={gift.amountCents}
                status={gift.status}
                note={gift.note}
                role="sender"
                counterpartyLabel={gift.recipient.displayName ?? gift.recipient.email}
              />
            ))}
            {sent.length === 0 && <p className="text-sm text-paper-dim">Nothing sent yet.</p>}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm uppercase tracking-wide text-paper-dim">Received</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {received.map((gift) => (
              <GiftCard
                key={gift.id}
                id={gift.id}
                amountCents={gift.amountCents}
                status={gift.status}
                note={gift.note}
                role="recipient"
                counterpartyLabel={gift.sender.displayName ?? gift.sender.email}
              />
            ))}
            {received.length === 0 && (
              <p className="text-sm text-paper-dim">
                You can see it. You can&apos;t touch it yet — nothing waiting right now.
              </p>
            )}
          </div>
        </section>
      </main>
    </>
  )
}
