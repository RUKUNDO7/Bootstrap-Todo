-- Remove leftover auth-related schema artifacts after JWT/auth cleanup.
-- Safe to run multiple times.

DO $$
DECLARE
  fk_name text;
BEGIN
  -- Drop FK from todo_items.owner_id -> users.id if it exists.
  SELECT tc.constraint_name
  INTO fk_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
   AND tc.table_schema = kcu.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND tc.table_name = 'todo_items'
    AND kcu.column_name = 'owner_id'
  LIMIT 1;

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.todo_items DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;

ALTER TABLE IF EXISTS public.todo_items
  DROP COLUMN IF EXISTS owner_id;

DROP TABLE IF EXISTS public.users CASCADE;
DROP TYPE IF EXISTS public.user_role;
