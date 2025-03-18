import { User, StudentProfile, Question, InsertUser } from "@shared/schema";
import session from "express-session";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { users, studentProfiles, questions } from "@shared/schema";
import connectPg from "connect-pg-simple";
import { log } from "./vite";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateStripeCustomerId(userId: number, customerId: string): Promise<User>;
  updateUserStripeInfo(userId: number, info: { customerId: string, subscriptionId: string }): Promise<User>;
  getStudentProfile(userId: number): Promise<StudentProfile | undefined>;
  createStudentProfile(profile: Omit<StudentProfile, "id">): Promise<StudentProfile>;
  getDailyQuestions(subject: string, grade: number): Promise<Question[]>;
  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is required");
    }

    this.sessionStore = new PostgresSessionStore({
      conObject: {
        connectionString: process.env.DATABASE_URL,
      },
      createTableIfMissing: true,
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    try {
      log(`Getting user by id: ${id}`);
      const results = await db.select().from(users).where(eq(users.id, id));
      log(`Found user: ${results[0] ? 'yes' : 'no'}`);
      return results[0];
    } catch (err) {
      log(`Error getting user by id: ${err.message}`);
      throw err;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      log(`Getting user by email: ${email}`);
      const results = await db.select().from(users).where(eq(users.email, email));
      log(`Found user by email: ${results[0] ? 'yes' : 'no'}`);
      return results[0];
    } catch (err) {
      log(`Error getting user by email: ${err.message}`);
      throw err;
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    try {
      log(`Creating user with data: ${JSON.stringify(insertUser)}`);
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 7);

      const result = await db.insert(users).values({
        ...insertUser,
        isSubscribed: false,
        trialEndsAt: trialEndsAt.toISOString(),
        stripeCustomerId: null,
        stripeSubscriptionId: null,
      }).returning();

      log(`User created successfully: ${JSON.stringify(result[0])}`);
      return result[0];
    } catch (err) {
      log(`Error creating user: ${err.message}`);
      throw err;
    }
  }

  async updateStripeCustomerId(userId: number, customerId: string): Promise<User> {
    try {
      const result = await db
        .update(users)
        .set({ stripeCustomerId: customerId })
        .where(eq(users.id, userId))
        .returning();
      return result[0];
    } catch (err) {
      log(`Error updating stripe customer id: ${err.message}`);
      throw err;
    }
  }

  async updateUserStripeInfo(userId: number, info: { customerId: string, subscriptionId: string }): Promise<User> {
    try {
      const result = await db
        .update(users)
        .set({
          stripeCustomerId: info.customerId,
          stripeSubscriptionId: info.subscriptionId,
          isSubscribed: true,
        })
        .where(eq(users.id, userId))
        .returning();
      return result[0];
    } catch (err) {
      log(`Error updating user stripe info: ${err.message}`);
      throw err;
    }
  }

  async getStudentProfile(userId: number): Promise<StudentProfile | undefined> {
    try {
      const results = await db
        .select()
        .from(studentProfiles)
        .where(eq(studentProfiles.userId, userId));
      return results[0];
    } catch (err) {
      log(`Error getting student profile: ${err.message}`);
      throw err;
    }
  }

  async createStudentProfile(profile: Omit<StudentProfile, "id">): Promise<StudentProfile> {
    try {
      const result = await db
        .insert(studentProfiles)
        .values(profile)
        .returning();
      return result[0];
    } catch (err) {
      log(`Error creating student profile: ${err.message}`);
      throw err;
    }
  }

  async getDailyQuestions(subject: string, grade: number): Promise<Question[]> {
    try {
      return await db
        .select()
        .from(questions)
        .where(eq(questions.subject, subject))
        .where(eq(questions.grade, grade))
        .limit(20);
    } catch (err) {
      log(`Error getting daily questions: ${err.message}`);
      throw err;
    }
  }
}

export const storage = new DatabaseStorage();