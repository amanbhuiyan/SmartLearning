import { pgTable, text, serial, integer, boolean, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
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
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  subject: text("subject").notNull(),
  grade: integer("grade").notNull(),
  lastQuestionDate: date("last_question_date"),
});

export const questions = pgTable("questions", {
  id: serial("id").primaryKey(),
  subject: text("subject").notNull(),
  grade: integer("grade").notNull(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  explanation: text("explanation"),
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
  subjects: z.array(z.enum(['math', 'english'])).min(1, "Please select at least one subject"),
  grade: z.number().min(1).max(10),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginData = z.infer<typeof loginSchema>;
export type User = typeof users.$inferSelect;
export type StudentSubject = typeof studentSubjects.$inferSelect;
export type Question = typeof questions.$inferSelect;