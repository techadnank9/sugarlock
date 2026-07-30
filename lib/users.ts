import { prisma } from './prisma'

type Auth0SessionUser = {
  sub: string
  email?: string | null
  name?: string | null
}

/** Upserts by email — the stable join key across sender/recipient/confirmer,
 * since recipients and confirmers are referenced by email before they ever log in. */
export async function upsertUserForSession(user: Auth0SessionUser) {
  const email = user.email ?? `${user.sub}@unknown.local`
  return prisma.user.upsert({
    where: { email },
    update: { auth0Id: user.sub, displayName: user.name ?? undefined },
    create: { auth0Id: user.sub, email, displayName: user.name },
  })
}

/** Creates a placeholder row for someone who hasn't logged in yet, keyed by email.
 * When they do log in, upsertUserForSession reconciles auth0Id onto this same row. */
export async function upsertPendingUser(email: string) {
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { auth0Id: `pending:${email}`, email },
  })
}
