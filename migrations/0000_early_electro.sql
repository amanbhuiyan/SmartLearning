CREATE TABLE "questions" (
	"question_id" serial PRIMARY KEY NOT NULL,
	"subject" text NOT NULL,
	"grade" integer NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"explanation" text
);
--> statement-breakpoint
CREATE TABLE "student_subjects" (
	"student_subject_id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"subjects" text[] NOT NULL,
	"grade" integer NOT NULL,
	"last_question_date" date
);
--> statement-breakpoint
CREATE TABLE "users" (
	"user_id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"is_subscribed" boolean DEFAULT false,
	"trial_ends_at" date,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "student_subjects" ADD CONSTRAINT "student_subjects_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION;