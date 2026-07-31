export type GiftStatus = 'scheduled' | 'ordered' | 'delivered'

export type PaymentStatus = 'unpaid' | 'paid'

export type ScheduledGift = {
  id: string
  recipientName: string
  address: string
  lat: number | null
  lng: number | null
  occasion: string | null
  eventDate: string
  graceDays: number
  colorHex: string
  productIcon: string | null
  productName: string | null
  productPriceCents: number | null
  productStore: string | null
  status: GiftStatus
  paymentStatus: PaymentStatus
}
