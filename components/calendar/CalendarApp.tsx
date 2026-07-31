'use client'

import { useCallback, useEffect, useState } from 'react'
import styles from './calendar.module.css'
import { Sidebar } from './Sidebar'
import { CalendarTopBar } from './CalendarTopBar'
import { MonthGrid } from './MonthGrid'
import { ScheduleGiftModal } from './ScheduleGiftModal'
import type { ScheduledGift } from './types'

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function CalendarApp({ isGuest }: { isGuest: boolean }) {
  const [gifts, setGifts] = useState<ScheduledGift[]>([])
  const [viewDate, setViewDate] = useState(() => new Date())
  const [modalState, setModalState] = useState<{ date: Date; gift: ScheduledGift | null } | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/gifts')
    if (!res.ok) return
    const { gifts: loaded } = await res.json()
    setGifts(loaded)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (gifts.length === 0) return
    if (gifts.every((g) => g.status === 'delivered')) return
    fetch('/api/cron/order-check').then(load)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gifts.length])

  function openModalForDate(date: Date) {
    const existing = gifts.find((g) => sameDay(new Date(g.eventDate), date)) ?? null
    setModalState({ date, gift: existing })
  }

  function openModalForGift(gift: ScheduledGift) {
    setModalState({ date: new Date(gift.eventDate), gift })
  }

  async function handleSaved() {
    setModalState(null)
    await load()
  }

  return (
    <div className={styles.app}>
      <Sidebar
        gifts={gifts}
        isGuest={isGuest}
        onScheduleClick={() => openModalForDate(new Date())}
        onUpcomingClick={openModalForGift}
      />
      <main className={styles.main}>
        <CalendarTopBar viewDate={viewDate} onChange={setViewDate} />
        <MonthGrid viewDate={viewDate} gifts={gifts} onDayClick={openModalForDate} />
      </main>
      {modalState && (
        <ScheduleGiftModal
          date={modalState.date}
          existingGift={modalState.gift}
          onClose={() => setModalState(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
