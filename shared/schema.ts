import { pgTable, text, serial, integer, boolean, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  user_id: serial("user_id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  isSubscribed: boolean("is_subscribed").default(false),
  trialEndsAt: date("trial_ends_at"),
});

// Each student can have multiple subjects
export const studentSubjects = pgTable("student_subjects", {
  student_subject_id: serial("student_subject_id").primaryKey(),
  user_id: integer("user_id")
    .references(() => users.user_id, { onDelete: 'cascade' })
    .notNull(),
  childName: text("child_name").notNull(),
  subject: text("subject").notNull(),
  grade: integer("grade").notNull(),
  lastQuestionDate: date("last_question_date"),
  preferredEmailTime: text("preferred_email_time").notNull().default("09:00 AM"),
});

// Schema for registration
export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
  firstName: true,
  lastName: true,
});

// Schema for login
export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

// Schema for profile setup
export const insertProfileSchema = z.object({
  childName: z.string().min(1, "Child's name is required"),
  subjects: z.array(z.enum(['math', 'english'])).min(1, "Please select at least one subject"),
  grade: z.number().min(1).max(10),
  preferredEmailTime: z.string().regex(/^(0[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/, "Invalid time format. Use HH:MM AM/PM"),
});

// Question type definition (for runtime use only, not stored in DB)
export interface Question {
  question: string;
  answer: string;
  explanation: string;
}

export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginData = z.infer<typeof loginSchema>;
export type User = typeof users.$inferSelect;
export type StudentSubject = typeof studentSubjects.$inferSelect;