'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import styles from './calendar.module.css'
import { searchCatalog, STORE_COLORS, type CatalogItem } from '@/lib/catalog'
import { fetchGeocode } from '@/lib/geocode'
import type { ScheduledGift } from './types'

const AddressMap = dynamic(() => import('./AddressMap').then((m) => m.AddressMap), { ssr: false })

const COLOR_PALETTE = [
  { name: 'Tomato', hex: '#D50000' },
  { name: 'Tangerine', hex: '#F4511E' },
  { name: 'Banana', hex: '#F6BF26' },
  { name: 'Sage', hex: '#33B679' },
  { name: 'Basil', hex: '#0B8043' },
  { name: 'Peacock', hex: '#039BE5' },
  { name: 'Blueberry', hex: '#3F51B5' },
  { name: 'Lavender', hex: '#7986CB' },
  { name: 'Grape', hex: '#8E24AA' },
  { name: 'Flamingo', hex: '#E67C73' },
  { name: 'Graphite', hex: '#616161' },
]
const DEFAULT_COLOR = COLOR_PALETTE[1].hex

type AddressStatus = 'idle' | 'loading' | 'found' | 'error'

export function ScheduleGiftModal({
  date,
  existingGift,
  onClose,
  onSaved,
}: {
  date: Date
  existingGift: ScheduledGift | null
  onClose: () => void
  onSaved: () => void
}) {
  const [recipientName, setRecipientName] = useState(existingGift?.recipientName ?? '')
  const [address, setAddress] = useState(existingGift?.address ?? '')
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(
    existingGift?.lat != null && existingGift?.lng != null ? { lat: existingGift.lat, lng: existingGift.lng } : null,
  )
  const [addressStatus, setAddressStatus] = useState<AddressStatus>(existingGift?.lat != null ? 'found' : 'idle')
  const [retryNonce, setRetryNonce] = useState(0)
  const [color, setColor] = useState(existingGift?.colorHex ?? DEFAULT_COLOR)
  const [graceDays, setGraceDays] = useState(existingGift?.graceDays ?? 4)
  const [productQuery, setProductQuery] = useState('')
  const [productBudget, setProductBudget] = useState('')
  const [suggestions, setSuggestions] = useState<CatalogItem[]>([])
  const [searched, setSearched] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<CatalogItem | null>(
    existingGift?.productName
      ? {
          icon: existingGift.productIcon ?? '🎁',
          name: existingGift.productName,
          price: (existingGift.productPriceCents ?? 0) / 100,
          store: existingGift.productStore ?? '',
          tags: [],
        }
      : null,
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const trimmed = address.trim()
    if (trimmed.length < 6) {
      setAddressStatus('idle')
      setPin(null)
      return
    }
    setAddressStatus('loading')
    const timer = setTimeout(async () => {
      try {
        const result = await fetchGeocode(trimmed)
        if (result) {
          setPin(result)
          setAddressStatus('found')
        } else {
          setPin(null)
          setAddressStatus('error')
        }
      } catch {
        setPin(null)
        setAddressStatus('error')
      }
    }, 900)
    return () => clearTimeout(timer)
  }, [address, retryNonce])

  const dateLabel = useMemo(
    () => date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }),
    [date],
  )
  const graceExplainLabel = useMemo(() => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), [date])

  function handleSearch() {
    const budget = productBudget ? parseFloat(productBudget) : null
    setSuggestions(searchCatalog(productQuery, budget))
    setSearched(true)
  }

  async function handleSave() {
    if (!recipientName.trim()) return
    setSaving(true)
    setError(null)

    const payload = {
      recipientName: recipientName.trim(),
      address: address.trim(),
      lat: pin?.lat ?? null,
      lng: pin?.lng ?? null,
      eventDate: date.toISOString(),
      graceDays,
      colorHex: color,
      product: selectedProduct,
    }

    try {
      const res = await fetch(existingGift ? `/api/gifts/${existingGift.id}` : '/api/gifts', {
        method: existingGift ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Could not save gift')
      onSaved()
    } catch (err) {
      setError((err as Error).message)
      setSaving(false)
    }
  }

  return (
    <div
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className={styles.modal}>
        <div className={styles['modal-header']}>
          <div>
            <h2>Schedule a gift</h2>
            <p>Sugarlock will place the order and time shipping to arrive on the day.</p>
          </div>
          <button className={styles['close-x']} onClick={onClose}>✕</button>
        </div>

        <div className={styles['modal-body']}>
          <div className={styles.field}>
            <label>Special day</label>
            <div className={styles['event-date-display']}>🎁 {dateLabel}</div>
          </div>

          <div className={styles.field}>
            <label>Event color</label>
            <div className={styles['color-picker']}>
              {COLOR_PALETTE.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  className={`${styles['color-swatch']} ${color === c.hex ? styles.selected : ''}`}
                  style={{ background: c.hex }}
                  title={c.name}
                  aria-label={c.name}
                  onClick={() => setColor(c.hex)}
                />
              ))}
            </div>
          </div>

          <div className={styles.field}>
            <label>Recipient name</label>
            <input
              type="text"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="e.g. Maria Chen"
            />
          </div>

          <div className={styles.field}>
            <label>Shipping address</label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street, city, state, ZIP"
              rows={2}
            />
            <div className={`${styles['address-status']} ${addressStatus === 'found' ? styles.found : ''}`}>
              {addressStatus === 'loading' && (
                <>
                  <span className={styles.spinner} /> Finding on map…
                </>
              )}
              {addressStatus === 'found' && '📍 Pinned'}
              {addressStatus === 'error' && (
                <>
                  Couldn&apos;t find that on the map yet.{' '}
                  <a
                    href="#"
                    className={styles['retry-link']}
                    onClick={(e) => {
                      e.preventDefault()
                      setRetryNonce((n) => n + 1)
                    }}
                  >
                    Try again
                  </a>
                </>
              )}
            </div>
            {pin && <AddressMap lat={pin.lat} lng={pin.lng} visible={addressStatus === 'found'} />}
          </div>

          <div className={styles.field}>
            <label>
              Find a gift <span className={styles.hint}>— type what you&apos;re picturing and a budget</span>
            </label>
            <div className={styles['product-search-row']}>
              <input
                type="text"
                className={styles['query-input']}
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="e.g. headphones"
              />
              <div className={styles['budget-input-wrap']}>
                <span>$</span>
                <input
                  type="number"
                  min="0"
                  value={productBudget}
                  onChange={(e) => setProductBudget(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Up to"
                />
              </div>
              <button className={styles['find-btn']} onClick={handleSearch}>Suggest</button>
            </div>

            {suggestions.length > 0 && (
              <div className={styles.suggestions}>
                {suggestions.slice(0, 6).map((item) => (
                  <div
                    key={item.name}
                    className={`${styles['suggestion-card']} ${selectedProduct?.name === item.name ? styles.selected : ''}`}
                    onClick={() => setSelectedProduct(item)}
                  >
                    <div className={styles['suggestion-check']}>✓</div>
                    <div className={styles['suggestion-icon']}>{item.icon}</div>
                    <div className={styles['suggestion-name']}>{item.name}</div>
                    <div className={styles['suggestion-meta']}>
                      <span className={styles['store-dot']} style={{ background: STORE_COLORS[item.store] ?? '#999' }} />
                      ${item.price} · {item.store}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {searched && suggestions.length === 0 && (
              <div className={styles['no-results']}>No matches under that budget — try raising it or a different word.</div>
            )}

            {selectedProduct && (
              <div className={styles['selected-summary']}>
                <div className={styles.icon}>{selectedProduct.icon}</div>
                <div className={styles.info}>
                  <div className={styles.name}>{selectedProduct.name}</div>
                  <div className={styles.meta}>
                    <span className={styles['store-dot']} style={{ background: STORE_COLORS[selectedProduct.store] ?? '#999' }} />
                    ${selectedProduct.price} · {selectedProduct.store} · saved to this gift
                  </div>
                </div>
                <button className={styles['clear-btn']} onClick={() => setSelectedProduct(null)}>Change</button>
              </div>
            )}
          </div>

          <div className={styles.field}>
            <label>
              Grace period <span className={styles.hint}>— how early the gift can arrive before the day</span>
            </label>
            <div className={styles['grace-control']}>
              <input
                type="range"
                min="1"
                max="10"
                value={graceDays}
                onChange={(e) => setGraceDays(parseInt(e.target.value, 10))}
              />
              <div className={styles['grace-value']}>
                {graceDays} day{graceDays === 1 ? '' : 's'}
              </div>
            </div>
            <div className={styles['grace-explain']}>
              Sugarlock will place the order so it arrives sometime in the{' '}
              <b>
                {graceDays}-day window before {graceExplainLabel}
              </b>{' '}
              — never later.
            </div>
          </div>

          {error && <p style={{ fontSize: 12.5, color: 'var(--rose-deep)' }}>{error}</p>}
        </div>

        <div className={styles['modal-footer']}>
          <button className={styles.btn} onClick={onClose}>Cancel</button>
          <button className={`${styles.btn} ${styles.primary}`} disabled={saving} onClick={handleSave}>
            {saving ? 'Saving…' : 'Save gift'}
          </button>
        </div>
      </div>
    </div>
  )
}
