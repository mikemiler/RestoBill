-- Migration: Add Review Feature
-- Date: 2026-01-09
-- Description: Adds Review model, googlePlaceId to Bill, reviewed to Selection

-- 1. Add googlePlaceId to Bill table
ALTER TABLE "Bill"
ADD COLUMN IF NOT EXISTS "googlePlaceId" TEXT;

-- 2. Add reviewed field to Selection table
ALTER TABLE "Selection"
ADD COLUMN IF NOT EXISTS "reviewed" BOOLEAN DEFAULT false NOT NULL;

-- 3. Create ReviewSentiment enum
DO $$ BEGIN
    CREATE TYPE "ReviewSentiment" AS ENUM ('SUPER', 'GUT', 'OKAY', 'MAESSIG', 'SCHLECHT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 4. Create Review table
CREATE TABLE IF NOT EXISTS "Review" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Relations
    "billId" TEXT NOT NULL,
    "selectionId" TEXT,

    -- Review Data
    "sentiment" "ReviewSentiment" NOT NULL,
    "isPositive" BOOLEAN NOT NULL,

    -- Google Review Tracking
    "googleReviewClicked" BOOLEAN NOT NULL DEFAULT false,

    -- Internal Feedback
    "internalFeedback" TEXT,

    -- Foreign Keys
    CONSTRAINT "Review_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Review_selectionId_fkey" FOREIGN KEY ("selectionId") REFERENCES "Selection"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- 5. Create indexes for Review table
CREATE INDEX IF NOT EXISTS "Review_billId_idx" ON "Review"("billId");
CREATE INDEX IF NOT EXISTS "Review_selectionId_idx" ON "Review"("selectionId");

-- 6. Add comment for documentation
COMMENT ON TABLE "Review" IS 'Post-payment guest feedback with sentiment tracking and Google review conversion metrics';
