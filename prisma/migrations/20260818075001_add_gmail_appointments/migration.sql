-- AlterTable
ALTER TABLE "User" ADD COLUMN     "gmailLastSyncAt" TIMESTAMP(3),
ADD COLUMN     "gmailSyncEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "GmailAppointment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gmailMessageId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "appointmentDate" TIMESTAMP(3) NOT NULL,
    "appointmentTime" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sourceSubject" TEXT NOT NULL,
    "sourceSnippet" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmailAppointment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GmailAppointment_userId_appointmentDate_idx" ON "GmailAppointment"("userId", "appointmentDate");

-- CreateIndex
CREATE UNIQUE INDEX "GmailAppointment_userId_gmailMessageId_key" ON "GmailAppointment"("userId", "gmailMessageId");

-- AddForeignKey
ALTER TABLE "GmailAppointment" ADD CONSTRAINT "GmailAppointment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
