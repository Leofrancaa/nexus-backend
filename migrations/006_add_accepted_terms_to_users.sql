-- Migration: Add accepted_terms column to users table
-- Description: Tracks if user has accepted terms and conditions

ALTER TABLE users
ADD COLUMN accepted_terms BOOLEAN DEFAULT false NOT NULL,
ADD COLUMN accepted_terms_at TIMESTAMP;

-- Update existing users to have accepted terms (retroactive)
UPDATE users
SET accepted_terms = true,
    accepted_terms_at = created_at
WHERE accepted_terms = false;
