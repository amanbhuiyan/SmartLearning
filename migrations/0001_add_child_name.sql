ALTER TABLE "student_subjects" ADD COLUMN IF NOT EXISTS "child_name" text NOT NULL DEFAULT 'Student';
-- Remove the default after adding the column
ALTER TABLE "student_subjects" ALTER COLUMN "child_name" DROP DEFAULT;
