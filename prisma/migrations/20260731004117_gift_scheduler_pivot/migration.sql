/*
  Warnings:

  - You are about to drop the `Condition` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Confirmation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Gift` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `LedgerEntry` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "ScheduledGiftStatus" AS ENUM ('scheduled', 'ordered', 'delivered');

-- DropForeignKey
ALTER TABLE "Condition" DROP CONSTRAINT "Condition_giftId_fkey";

-- DropForeignKey
ALTER TABLE "Confirmation" DROP CONSTRAINT "Confirmation_conditionId_fkey";

-- DropForeignKey
ALTER TABLE "Confirmation" DROP CONSTRAINT "Confirmation_confirmerId_fkey";

-- DropForeignKey
ALTER TABLE "Gift" DROP CONSTRAINT "Gift_recipientId_fkey";

-- DropForeignKey
ALTER TABLE "Gift" DROP CONSTRAINT "Gift_senderId_fkey";

-- DropForeignKey
ALTER TABLE "LedgerEntry" DROP CONSTRAINT "LedgerEntry_giftId_fkey";

-- DropTable
DROP TABLE "Condition";

-- DropTable
DROP TABLE "Confirmation";

-- DropTable
DROP TABLE "Gift";

-- DropTable
DROP TABLE "LedgerEntry";

-- DropEnum
DROP TYPE "ConditionType";

-- DropEnum
DROP TYPE "Decision";

-- DropEnum
DROP TYPE "GiftStatus";

-- CreateTable
CREATE TABLE "ScheduledGift" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "occasion" TEXT,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "graceDays" INTEGER NOT NULL DEFAULT 4,
    "colorHex" TEXT NOT NULL,
    "productIcon" TEXT,
    "productName" TEXT,
    "productPriceCents" INTEGER,
    "productStore" TEXT,
    "status" "ScheduledGiftStatus" NOT NULL DEFAULT 'scheduled',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledGift_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ScheduledGift" ADD CONSTRAINT "ScheduledGift_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
