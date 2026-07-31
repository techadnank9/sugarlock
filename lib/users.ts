import { prisma } from './prisma'

type Auth0SessionUser = {
  sub: string
  email?: string | null
  name?: string | null
}

/** Upserts by email. Recipients are plain fields on ScheduledGift now (no
 * account of their own), so email only ever identifies the signed-in sender. */
export async function upsertUserForSession(user: Auth0SessionUser) {
  const email = user.email ?? `${user.sub}@unknown.local`
  return prisma.user.upsert({
    where: { email },
    update: { auth0Id: user.sub, displayName: user.name ?? undefined },
    create: { auth0Id: user.sub, email, displayName: user.name },
  })
}
