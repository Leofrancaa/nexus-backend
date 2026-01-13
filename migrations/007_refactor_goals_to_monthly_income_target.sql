-- Migration: Refactor goals table to monthly income targets
-- Description: Changes goals from category-based to simple monthly income targets
-- Now each user can have one goal per month/year with a target income value

-- Step 1: Remove duplicates - keep only the most recent goal for each user/month/year
DELETE FROM goals
WHERE id NOT IN (
    SELECT MAX(id)
    FROM goals
    GROUP BY user_id, mes, ano
);

-- Step 2: Remove category_id and tipo columns (no longer needed)
ALTER TABLE goals
DROP COLUMN IF EXISTS category_id,
DROP COLUMN IF EXISTS tipo;

-- Step 3: Update nome column to be more flexible (increase length if needed)
ALTER TABLE goals
ALTER COLUMN nome TYPE VARCHAR(255);

-- Step 4: Add a unique constraint to ensure one goal per user per month/year
ALTER TABLE goals
ADD CONSTRAINT unique_user_month_year UNIQUE (user_id, mes, ano);

-- Step 5: Update existing goals to have a generic name if empty
UPDATE goals
SET nome = 'Meta de Receita'
WHERE nome IS NULL OR nome = '';
