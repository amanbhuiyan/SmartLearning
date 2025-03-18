CREATE TABLE "questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"subject" text NOT NULL,
	"grade" integer NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"explanation" text
);
--> statement-breakpoint
CREATE TABLE "student_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"subjects" text[] NOT NULL,
	"grade" integer NOT NULL,
	"last_question_date" date
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
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
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;