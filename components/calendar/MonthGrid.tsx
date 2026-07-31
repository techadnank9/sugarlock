'use client'

import styles from './calendar.module.css'
import type { ScheduledGift } from './types'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function dayKey(y: number, m: number, d: number): string {
  return `${y}-${m}-${d}`
}

function sameYMD(date: Date, y: number, m: number, d: number): boolean {
  return date.getFullYear() === y && date.getMonth() === m && date.getDate() === d
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

export function MonthGrid({
  viewDate,
  gifts,
  onDayClick,
}: {
  viewDate: Date
  gifts: ScheduledGift[]
  onDayClick: (date: Date) => void
}) {
  const y = viewDate.getFullYear()
  const m = viewDate.getMonth()
  const today = new Date()

  const firstOfMonth = new Date(y, m, 1)
  const startOffset = firstOfMonth.getDay()
  const gridStart = new Date(y, m, 1 - startOffset)

  const giftsByDay = new Map<string, ScheduledGift>()
  for (const gift of gifts) {
    const d = new Date(gift.eventDate)
    giftsByDay.set(dayKey(d.getFullYear(), d.getMonth(), d.getDate()), gift)
  }

  const graceDays = new Set<string>()
  for (const gift of gifts) {
    const eventDate = new Date(gift.eventDate)
    for (let g = 1; g <= gift.graceDays; g++) {
      const gd = new Date(eventDate)
      gd.setDate(gd.getDate() - g)
      graceDays.add(dayKey(gd.getFullYear(), gd.getMonth(), gd.getDate()))
    }
  }

  const cells = []
  for (let i = 0; i < 42; i++) {
    const cellDate = new Date(gridStart)
    cellDate.setDate(gridStart.getDate() + i)
    const cy = cellDate.getFullYear()
    const cm = cellDate.getMonth()
    const cd = cellDate.getDate()
    const gift = giftsByDay.get(dayKey(cy, cm, cd))

    const classNames = [styles['day-cell']]
    if (cm !== m) classNames.push(styles['other-month'])
    if (sameYMD(today, cy, cm, cd)) classNames.push(styles['is-today'])
    if (graceDays.has(dayKey(cy, cm, cd))) classNames.push(styles['grace-range'])

    cells.push(
      <div key={i} className={classNames.join(' ')} onClick={() => onDayClick(new Date(cy, cm, cd))}>
        <div className={styles['day-num']}>{cd}</div>
        {gift && (
          <>
            <div
              className={styles['gift-chip']}
              style={{
                background: hexToRgba(gift.colorHex, 0.14),
                color: gift.colorHex,
                borderLeft: `3px solid ${gift.colorHex}`,
              }}
              title={
                gift.productName
                  ? `${gift.productName} · $${((gift.productPriceCents ?? 0) / 100).toFixed(0)}`
                  : gift.recipientName
              }
            >
              <span className={styles['gift-icon']}>{gift.productIcon ?? '🎁'}</span> {gift.recipientName}
            </div>
            <div className={styles['grace-tag']}>Grace {gift.graceDays}d</div>
          </>
        )}
      </div>,
    )
  }

  return (
    <div className={styles['grid-wrap']}>
      <div className={styles['weekday-row']}>
        {WEEKDAYS.map((day) => (
          <div key={day}>{day}</div>
        ))}
      </div>
      <div className={styles['month-grid']}>{cells}</div>
    </div>
  )
}
