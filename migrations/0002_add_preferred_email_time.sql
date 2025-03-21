-- Add preferred_email_time column with default value
ALTER TABLE "student_subjects" ADD COLUMN IF NOT EXISTS "preferred_email_time" text NOT NULL DEFAULT '09:00 AM';
