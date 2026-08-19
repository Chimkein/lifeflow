-- Add an explicit primary key to Session (backfilling existing rows),
-- add missing lookup/foreign-key indexes, and correct the User.ollamaModel
-- default so it matches schema.prisma (the 20260818065513_add_ai_chat
-- migration created the column with the divergent default 'llama3.1:8b').

-- Session: introduce a primary key without breaking existing rows.
ALTER TABLE "Session" ADD COLUMN "id" TEXT;
UPDATE "Session" SET "id" = gen_random_uuid()::text WHERE "id" IS NULL;
ALTER TABLE "Session" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE "Session" ADD CONSTRAINT "Session_pkey" PRIMARY KEY ("id");

-- Indexes for columns the application filters/joins on.
CREATE INDEX "Account_userId_provider_idx" ON "Account"("userId", "provider");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "TaskNote_noteId_idx" ON "TaskNote"("noteId");

-- Correct the column default that diverged from schema.prisma.
-- (Only the default is changed; existing rows are left untouched.)
ALTER TABLE "User" ALTER COLUMN "ollamaModel" SET DEFAULT 'openai/gpt-oss-20b';
