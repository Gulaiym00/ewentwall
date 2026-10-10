-- CreateEnum
CREATE TYPE "SupportTopic" AS ENUM ('PASSWORD', 'ACCOUNT', 'EVENT', 'OTHER');

-- CreateEnum
CREATE TYPE "SupportStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "userId" UUID,
    "topic" "SupportTopic" NOT NULL DEFAULT 'OTHER',
    "message" TEXT NOT NULL,
    "status" "SupportStatus" NOT NULL DEFAULT 'OPEN',
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupportTicket_status_createdAt_idx" ON "SupportTicket"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
