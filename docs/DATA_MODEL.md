# Data model

Postgres via Prisma. Lean by design so it builds in a hackathon window.

## Entities

- User — a person, linked to their Auth0 identity. Can be sender, recipient, or
  confirmer depending on context (role is per-relationship, not global).
- Gift — the core object: who, how much, current status, Stripe reference.
- Condition — one per gift. Holds the unlock type and its params.
- Confirmation — a confirmer's decision on a third_party condition.
- LedgerEntry — append-only money-movement log. This is how we model escrow
  without full Stripe Connect.

## Relationships

- User sends many Gifts, receives many Gifts.
- Gift has exactly one Condition.
- Gift has many LedgerEntry rows.
- Condition awaits many Confirmations (usually one).
- User confirms many Confirmations.

## Prisma schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum GiftStatus {
  draft
  funded
  locked
  unlocked
  released
}

enum ConditionType {
  time
  self
  third_party
  data
}

enum Decision {
  pending
  approved
  declined
}

model User {
  id             String   @id @default(uuid())
  auth0Id        String   @unique
  email          String   @unique
  displayName    String?
  sentGifts      Gift[]   @relation("sender")
  receivedGifts  Gift[]   @relation("recipient")
  confirmations  Confirmation[]
  createdAt      DateTime @default(now())
}

model Gift {
  id           String        @id @default(uuid())
  sender       User          @relation("sender", fields: [senderId], references: [id])
  senderId     String
  recipient    User          @relation("recipient", fields: [recipientId], references: [id])
  recipientId  String
  amountCents  Int
  note         String?
  status       GiftStatus    @default(draft)
  stripeRef    String?
  condition    Condition?
  ledger       LedgerEntry[]
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
}

model Condition {
  id            String         @id @default(uuid())
  gift          Gift           @relation(fields: [giftId], references: [id])
  giftId        String         @unique
  type          ConditionType
  params        Json           // { unlockAt } | { confirmerEmail, label } | ...
  unlockAt      DateTime?      // convenience column for time type
  confirmations Confirmation[]
}

model Confirmation {
  id           String    @id @default(uuid())
  condition    Condition @relation(fields: [conditionId], references: [id])
  conditionId  String
  confirmer    User      @relation(fields: [confirmerId], references: [id])
  confirmerId  String
  decision     Decision  @default(pending)
  decidedAt    DateTime?
}

model LedgerEntry {
  id           String   @id @default(uuid())
  gift         Gift     @relation(fields: [giftId], references: [id])
  giftId       String
  event        String   // 'funded' | 'unlocked' | 'released'
  amountCents  Int
  at           DateTime @default(now())
}
```

## Notes for Claude Code

- `params` is JSON so new condition types never need a migration. `unlockAt` is
  duplicated as a real column only because `time` unlocks are queried often.
- The ledger is append-only. Never update or delete a LedgerEntry — write a new
  one. Escrow "balance held" = sum of funded minus released for a gift.
- Confirmer sees a Condition + its Gift's note and recipient name ONLY. Never
  select amountCents into any confirmer-facing query.
