'use client'

import { useState } from 'react'
import styles from './landing.module.css'

export function PricingCard() {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')
  const isYearly = billing === 'yearly'

  return (
    <div className={styles['pricing-card']}>
      <div className={styles['plan-name']}>Sugarlock Plus</div>

      <div className={styles['billing-toggle']} role="group" aria-label="Billing period">
        <button
          type="button"
          className={!isYearly ? styles.active : undefined}
          aria-pressed={!isYearly}
          onClick={() => setBilling('monthly')}
        >
          Monthly
        </button>
        <button
          type="button"
          className={isYearly ? styles.active : undefined}
          aria-pressed={isYearly}
          onClick={() => setBilling('yearly')}
        >
          Yearly <span className={styles['save-tag']}>Save 24%</span>
        </button>
      </div>

      <div className={styles.price}>{isYearly ? <>$100<span>/year</span></> : <>$11<span>/month</span></>}</div>
      <div className={styles['price-note']}>{isYearly ? 'Billed once a year · cancel anytime' : 'Cancel anytime'}</div>

      <ul className={styles['pricing-list']}>
        <li><span className={styles.check}>✓</span> Unlimited scheduled gifts</li>
        <li><span className={styles.check}>✓</span> Suggestions from Amazon, Target, Walmart, Best Buy &amp; Etsy</li>
        <li><span className={styles.check}>✓</span> Grace-period shipping windows</li>
        <li><span className={styles.check}>✓</span> Address confirmation with map pins</li>
        <li><span className={styles.check}>✓</span> Color-coded calendar for every recipient</li>
      </ul>

      <a href="/auth/login" className={`${styles.btn} ${styles['btn-primary']} ${styles['btn-lg']}`} style={{ width: '100%' }}>
        Start free trial
      </a>
    </div>
  )
}
