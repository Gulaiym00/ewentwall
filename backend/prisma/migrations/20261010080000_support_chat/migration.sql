-- Support tickets become conversations: the first message moves to SupportMessage.

-- CreateTable
CREATE TABLE "SupportMessage" (
    "id" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "fromAdmin" BOOLEAN NOT NULL DEFAULT false,
    "authorId" UUID,
    "authorName" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "SupportTicket" ADD COLUMN     "adminUnread" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "userUnread" INTEGER NOT NULL DEFAULT 0;

-- Move existing ticket texts into the conversation
INSERT INTO "SupportMessage" ("id", "ticketId", "fromAdmin", "authorId", "authorName", "text", "createdAt")
SELECT gen_random_uuid(), "id", false, "userId", COALESCE("name", "email"), "message", "createdAt" FROM "SupportTicket";

UPDATE "SupportTicket" SET "lastMessageAt" = "createdAt", "adminUnread" = CASE WHEN "status" = 'OPEN' THEN 1 ELSE 0 END;

ALTER TABLE "SupportTicket" DROP COLUMN "message";

-- DropIndex
DROP INDEX "SupportTicket_status_createdAt_idx";

-- CreateIndex
CREATE INDEX "SupportMessage_ticketId_createdAt_idx" ON "SupportMessage"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "SupportTicket_status_lastMessageAt_idx" ON "SupportTicket"("status", "lastMessageAt");

-- CreateIndex
CREATE INDEX "SupportTicket_userId_lastMessageAt_idx" ON "SupportTicket"("userId", "lastMessageAt");

-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
