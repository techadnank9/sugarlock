'use client'

import styles from './calendar.module.css'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function CalendarTopBar({ viewDate, onChange }: { viewDate: Date; onChange: (date: Date) => void }) {
  function shiftMonth(delta: number) {
    const next = new Date(viewDate)
    next.setMonth(next.getMonth() + delta)
    onChange(next)
  }

  return (
    <div className={styles.topbar}>
      <div className={styles['topbar-left']}>
        <div className={styles['month-title']}>
          {MONTH_NAMES[viewDate.getMonth()]} {viewDate.getFullYear()}
        </div>
        <div className={styles['nav-btns']}>
          <button aria-label="Previous month" onClick={() => shiftMonth(-1)}>‹</button>
          <button aria-label="Next month" onClick={() => shiftMonth(1)}>›</button>
        </div>
      </div>
      <button className={styles['today-btn']} onClick={() => onChange(new Date())}>Today</button>
    </div>
  )
}
