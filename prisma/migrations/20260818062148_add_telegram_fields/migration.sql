-- AlterTable
ALTER TABLE "User" ADD COLUMN     "briefingEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "briefingTime" TEXT NOT NULL DEFAULT '07:00',
ADD COLUMN     "telegramChatId" TEXT;
