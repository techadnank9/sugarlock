export type GiftRole = 'sender' | 'recipient' | 'none'

export function roleForGift(userId: string, gift: { senderId: string; recipientId: string }): GiftRole {
  if (gift.senderId === userId) return 'sender'
  if (gift.recipientId === userId) return 'recipient'
  return 'none'
}
