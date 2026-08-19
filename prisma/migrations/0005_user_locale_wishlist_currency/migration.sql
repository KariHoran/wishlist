-- AlterTable
ALTER TABLE "User" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'ru';

-- AlterTable
ALTER TABLE "Wishlist" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'RUB';
