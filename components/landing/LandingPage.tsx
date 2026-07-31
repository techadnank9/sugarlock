import styles from './landing.module.css'
import { SkipLoginButton } from '@/components/SkipLoginButton'
import { PricingCard } from './PricingCard'

export function LandingPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <nav className={styles.nav}>
          <div className={styles.logo}>
            <div className={styles.mark}>S</div>
            <span>Sugarlock</span>
          </div>
          <div className={styles['nav-links']}>
            <a className={styles.navlink} href="#how">How it works</a>
            <a className={styles.navlink} href="#features">Features</a>
            <a className={styles.navlink} href="#pricing">Pricing</a>
          </div>
          <div className={styles['nav-cta']}>
            <a className={styles['signin-link']} href="/auth/login">Sign in</a>
            <a className={`${styles.btn} ${styles['btn-primary']}`} href="/auth/login">Get started</a>
          </div>
        </nav>
      </header>

      <main className={styles.wrap}>
        <section className={styles.hero}>
          <div>
            <span className={styles.eyebrow}>🎁 Gifting, on autopilot</span>
            <h1>Gifts that arrive <em>right on time</em> — every time.</h1>
            <p className={styles.sub}>
              Tell Sugarlock the day and who it&apos;s for. We&apos;ll suggest something within budget, and ship it
              to land in a window you set — never early, never late.
            </p>
            <div className={styles['hero-ctas']}>
              <a href="/auth/login" className={`${styles.btn} ${styles['btn-primary']} ${styles['btn-lg']}`}>
                Get started free
              </a>
              <a href="#how" className={styles['link-arrow']}>
                See how it works
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            </div>
            <div className={styles['trust-line']}>Shipping from the stores you already trust</div>
            <div className={styles['trust-marks']}>
              <div className={styles['store-chip']}><div className={styles.badge} style={{ background: '#FF9900' }}>a</div><span>Amazon</span></div>
              <div className={styles['store-chip']}><div className={styles.badge} style={{ background: '#CC0000' }}>T</div><span>Target</span></div>
              <div className={styles['store-chip']}><div className={styles.badge} style={{ background: '#0071CE' }}>W</div><span>Walmart</span></div>
              <div className={styles['store-chip']}><div className={styles.badge} style={{ background: '#0A4FA0' }}>BB</div><span>Best Buy</span></div>
              <div className={styles['store-chip']}><div className={styles.badge} style={{ background: '#F1641E' }}>e</div><span>Etsy</span></div>
              <div className={`${styles['store-chip']} ${styles.more}`}><span>+ many others, based on your selection</span></div>
            </div>
            <div style={{ marginTop: 18 }}>
              <SkipLoginButton />
            </div>
          </div>

          <div className={styles['daystrip-card']}>
            <div className={styles['daystrip-head']}>
              <div className={styles.who}>
                <div className={styles['daystrip-avatar']}>M</div>
                <div>
                  <div>Maria&apos;s birthday</div>
                  <small>Headphones · $59 · Best Buy</small>
                </div>
              </div>
              <div className={styles['daystrip-status']}>On schedule</div>
            </div>

            <div className={styles['strip-track']}>
              <div className={styles['gift-glider']}>🎁</div>
              <div className={styles['strip-day']}>6</div>
              <div className={styles['strip-day']}>7</div>
              <div className={styles['strip-day']}>8</div>
              <div className={`${styles['strip-day']} ${styles.grace}`}>9</div>
              <div className={`${styles['strip-day']} ${styles.grace}`}>10</div>
              <div className={`${styles['strip-day']} ${styles.grace}`}>11</div>
              <div className={`${styles['strip-day']} ${styles.eventday}`}><span className={styles.pin}>📍</span>12</div>
            </div>
            <div className={styles['strip-caption']}>
              <span><b>Grace window</b> · 3 days before</span>
              <span className={styles.arrive}>Arrives Mar 12</span>
            </div>
          </div>
        </section>

        <section className={styles.section} id="how">
          <div className={styles['section-head']}>
            <span className={styles['section-eyebrow']}>How it works</span>
            <h2>Three steps, then forget about it.</h2>
            <p>Sugarlock handles the remembering, the picking, and the shipping — you just say yes to the gift.</p>
          </div>
          <div className={styles.steps}>
            <div className={styles.step}>
              <span className={styles.stepnum}>01</span>
              <div className={styles['step-rule']} />
              <h3>Add the day</h3>
              <p>Drop a birthday, anniversary, or graduation on the calendar with who it&apos;s for and where it should go.</p>
            </div>
            <div className={styles.step}>
              <span className={styles.stepnum}>02</span>
              <div className={styles['step-rule']} />
              <h3>Pick from suggestions</h3>
              <p>Tell us a category and a budget — we&apos;ll pull real options from Amazon, Target, Walmart, and more.</p>
            </div>
            <div className={styles.step}>
              <span className={styles.stepnum}>03</span>
              <div className={styles['step-rule']} />
              <h3>It ships itself</h3>
              <p>Set a grace window and we place the order so it lands inside it. No last-minute scrambling.</p>
            </div>
          </div>
        </section>

        <section className={styles.section} id="features">
          <div className={styles['section-head']}>
            <span className={styles['section-eyebrow']}>Built for busy people</span>
            <h2>Everything a thoughtful gift needs — minus the last-minute panic.</h2>
          </div>
          <div className={styles.features}>
            <div className={styles['feature-card']}>
              <div className={styles['feature-icon']} style={{ background: 'var(--rose-tint)' }}>🔎</div>
              <h3>Smart suggestions</h3>
              <p>Type what you&apos;re picturing and a budget — get real, in-stock options back.</p>
            </div>
            <div className={styles['feature-card']}>
              <div className={styles['feature-icon']} style={{ background: 'var(--sage-tint)' }}>⏳</div>
              <h3>Grace period shipping</h3>
              <p>Set how early is okay to arrive. We time the order so it never lands late.</p>
            </div>
            <div className={styles['feature-card']}>
              <div className={styles['feature-icon']} style={{ background: 'var(--gold-tint)' }}>📍</div>
              <h3>Confirmed addresses</h3>
              <p>Every shipping address is pinned on a map before an order goes out.</p>
            </div>
            <div className={styles['feature-card']}>
              <div className={styles['feature-icon']} style={{ background: 'var(--rose-tint)' }}>🎨</div>
              <h3>Color-coded calendar</h3>
              <p>Give every person their own color, so your whole year is legible at a glance.</p>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles['quote-band']}>
            <div className={styles['quote-mark']}>&rdquo;</div>
            <div>
              <blockquote>
                I used to scramble for gifts every single month. Now Sugarlock handles it before I even remember the
                date is coming.
              </blockquote>
              <div className={styles.attribution}><b>Anna R.</b> — manages 20 birthdays a year with Sugarlock</div>
            </div>
          </div>
        </section>

        <section className={styles.section} id="pricing">
          <div className={styles['section-head']} style={{ marginLeft: 'auto', marginRight: 'auto', textAlign: 'center' }}>
            <span className={styles['section-eyebrow']}>Simple pricing</span>
            <h2>One plan. Every occasion.</h2>
          </div>
          <PricingCard />
        </section>

        <section className={styles.section} style={{ paddingTop: 0 }}>
          <div className={styles['final-cta']}>
            <h2>Never miss a day again.</h2>
            <p>Set up your first gift in under two minutes.</p>
            <a href="/auth/login" className={`${styles.btn} ${styles['btn-primary']} ${styles['btn-lg']}`}>Get started free</a>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={`${styles.wrap} ${styles['footer-row']}`}>
          <div className={styles.logo}>
            <div className={styles.mark}>S</div>
            <span>Sugarlock</span>
          </div>
          <div className={styles['footer-links']}>
            <a href="#how">How it works</a>
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <a href="/auth/login">Sign in</a>
          </div>
        </div>
        <div className={`${styles.wrap} ${styles['footer-fine']}`}>© 2026 Sugarlock. Built for the Auth0 × Stripe &quot;Built Different&quot; hackathon.</div>
      </footer>
    </div>
  )
}
