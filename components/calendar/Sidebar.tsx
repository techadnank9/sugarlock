'use client'

import styles from './calendar.module.css'
import { GuestLogoutButton } from '@/components/GuestLogoutButton'
import type { ScheduledGift } from './types'

const LEGEND_GRADIENT = 'linear-gradient(90deg,#D50000,#F4511E,#039BE5)'

export function Sidebar({
  gifts,
  isGuest,
  onScheduleClick,
  onUpcomingClick,
}: {
  gifts: ScheduledGift[]
  isGuest: boolean
  onScheduleClick: () => void
  onUpcomingClick: (gift: ScheduledGift) => void
}) {
  const upcoming = [...gifts].sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <div className={styles.mark}>S</div>
        <span>Sugarlock</span>
      </div>

      <button className={styles['new-btn']} onClick={onScheduleClick}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 3v10M3 8h10" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        Schedule a gift
      </button>

      <div className={styles['side-section']}>
        <div className={styles['side-title']}>Upcoming</div>
        <div>
          {upcoming.map((gift) => (
            <div key={gift.id} className={styles['upcoming-item']} onClick={() => onUpcomingClick(gift)}>
              <div className={styles['upcoming-dot']} style={{ background: gift.colorHex }} />
              <div>
                <div className={styles['upcoming-name']}>
                  {gift.recipientName}
                  {gift.occasion ? ` — ${gift.occasion}` : ''}
                </div>
                <div className={styles['upcoming-meta']}>
                  {gift.productName
                    ? `${gift.productIcon ?? ''} ${gift.productName} · $${((gift.productPriceCents ?? 0) / 100).toFixed(0)} · ${gift.productStore}`
                    : new Date(gift.eventDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
                <span className={`${styles['upcoming-status']} ${styles[gift.status]}`}>{gift.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={styles['side-section']}>
        <div className={styles['side-title']}>Legend</div>
        <div className={styles['legend-row']}>
          <div className={styles['legend-swatch']} style={{ background: LEGEND_GRADIENT }} /> Each gift has its own color
        </div>
        <div className={styles['legend-row']}>
          <div className={styles['legend-swatch']} style={{ background: 'var(--sage)' }} /> Grace period window
        </div>
      </div>

      <div className={styles['sidebar-footer']}>
        <span>{isGuest ? 'Browsing as guest' : 'Signed in'}</span>
        {isGuest ? <GuestLogoutButton /> : <a href="/auth/logout">Log out</a>}
      </div>
    </aside>
  )
}
