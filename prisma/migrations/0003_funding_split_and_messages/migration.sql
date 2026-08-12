-- CreateEnum
CREATE TYPE "FundingMode" AS ENUM ('FREE', 'FIXED_SPLIT');

-- AlterEnum NotificationType
ALTER TYPE "NotificationType" ADD VALUE 'ITEM_RESERVED';
ALTER TYPE "NotificationType" ADD VALUE 'ITEM_CONTRIBUTED';

-- AlterTable Item
ALTER TABLE "Item" ADD COLUMN "reservationMessage" TEXT;
ALTER TABLE "Item" ADD COLUMN "reservationAnonymous" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Item" ADD COLUMN "fundingMode" "FundingMode" NOT NULL DEFAULT 'FREE';
ALTER TABLE "Item" ADD COLUMN "splitParticipants" INTEGER;
ALTER TABLE "Item" ADD COLUMN "splitAmountPerPerson" DECIMAL(12,2);

-- AlterTable Contribution
ALTER TABLE "Contribution" ADD COLUMN "message" TEXT;
ALTER TABLE "Contribution" ADD COLUMN "isAnonymous" BOOLEAN NOT NULL DEFAULT false;
