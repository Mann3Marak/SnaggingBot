-- Force fix the inspection_results status constraint
-- This ensures the constraint allows all 5 status values

-- Drop ALL existing constraints on the status column
DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    FOR constraint_record IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'inspection_results'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) LIKE '%status%'
    LOOP
        EXECUTE 'ALTER TABLE inspection_results DROP CONSTRAINT IF EXISTS ' || constraint_record.conname;
    END LOOP;
END $$;

-- Add the correct constraint with all 5 values
ALTER TABLE inspection_results
ADD CONSTRAINT inspection_results_status_check
CHECK (status IN ('good', 'issue', 'critical', 'skipped', 'not_applicable'));

-- Add comment
COMMENT ON CONSTRAINT inspection_results_status_check ON inspection_results IS
'Allowed status values: good (meets standards), issue (minor defect), critical (major defect/safety), skipped (item not inspected), not_applicable (item does not exist in this unit)';
