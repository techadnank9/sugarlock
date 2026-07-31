-- Restores the Sugarlock domain schema after the out-of-band migration
-- `20260731004117_gift_scheduler_pivot` (not present in this repo) dropped it.
--
-- Additive only. "User" already exists with its rows and indexes intact, so it
-- is not recreated here. The foreign "ScheduledGift" table and its
-- "ScheduledGiftStatus" enum are left untouched on purpose.

-- CreateEnum
CREATE TYPE "GiftStatus" AS ENUM ('draft', 'funded', 'locked', 'unlocked', 'released');

-- CreateEnum
CREATE TYPE "ConditionType" AS ENUM ('time', 'self', 'third_party', 'data');

-- CreateEnum
CREATE TYPE "Decision" AS ENUM ('pending', 'approved', 'declined');

-- CreateTable
CREATE TABLE "Gift" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "note" TEXT,
    "status" "GiftStatus" NOT NULL DEFAULT 'draft',
    "stripeRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Gift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Condition" (
    "id" TEXT NOT NULL,
    "giftId" TEXT NOT NULL,
    "type" "ConditionType" NOT NULL,
    "params" JSONB NOT NULL,
    "unlockAt" TIMESTAMP(3),

    CONSTRAINT "Condition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Confirmation" (
    "id" TEXT NOT NULL,
    "conditionId" TEXT NOT NULL,
    "confirmerId" TEXT NOT NULL,
    "decision" "Decision" NOT NULL DEFAULT 'pending',
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "Confirmation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "giftId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Condition_giftId_key" ON "Condition"("giftId");

-- CreateIndex
CREATE UNIQUE INDEX "Confirmation_conditionId_key" ON "Confirmation"("conditionId");

-- AddForeignKey
ALTER TABLE "Gift" ADD CONSTRAINT "Gift_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gift" ADD CONSTRAINT "Gift_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Condition" ADD CONSTRAINT "Condition_giftId_fkey" FOREIGN KEY ("giftId") REFERENCES "Gift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Confirmation" ADD CONSTRAINT "Confirmation_conditionId_fkey" FOREIGN KEY ("conditionId") REFERENCES "Condition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Confirmation" ADD CONSTRAINT "Confirmation_confirmerId_fkey" FOREIGN KEY ("confirmerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_giftId_fkey" FOREIGN KEY ("giftId") REFERENCES "Gift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
