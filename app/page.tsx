import { getAppSession } from '@/lib/session'
import { upsertUserForSession } from '@/lib/users'
import { LandingPage } from '@/components/landing/LandingPage'
import { CalendarApp } from '@/components/calendar/CalendarApp'

export default async function Home() {
  const session = await getAppSession()
  if (!session?.user) return <LandingPage />

  await upsertUserForSession(session.user)
  return <CalendarApp isGuest={session.isGuest} />
}
