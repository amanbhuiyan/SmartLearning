import { User, StudentSubject, InsertUser } from "@shared/schema";
import session from "express-session";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { users, studentSubjects } from "@shared/schema";
import connectPg from "connect-pg-simple";
import { log } from "./vite";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateStripeCustomerId(userId: number, customerId: string): Promise<User>;
  updateUserStripeInfo(userId: number, info: { customerId: string, subscriptionId: string }): Promise<User>;
  getUserSubjects(userId: number): Promise<StudentSubject[]>;
  createUserSubjects(userId: number, childName: string, subjects: string[], grade: number): Promise<StudentSubject[]>;
  sessionStore: session.Store;
  getUserByStripeCustomerId(customerId: string): Promise<User | undefined>;
  updateSubscriptionStatus(userId: number, isSubscribed: boolean): Promise<User>;
  getAllUsers(): Promise<User[]>;
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

  async getAllUsers(): Promise<User[]> {
    try {
      log('Fetching all users from database');
      const results = await db.select().from(users);
      log(`Found ${results.length} users`);
      return results;
    } catch (error) {
      log(`Error getting all users: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async getUser(id: number): Promise<User | undefined> {
    try {
      log(`Getting user by id: ${id}`);
      const results = await db.select().from(users).where(eq(users.user_id, id));
      log(`Found user: ${results[0] ? 'yes' : 'no'}`);
      return results[0];
    } catch (error) {
      log(`Error getting user by id: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      log(`Getting user by email: ${email}`);
      const results = await db.select().from(users).where(eq(users.email, email));
      log(`Found user by email: ${results[0] ? 'yes' : 'no'}`);
      return results[0];
    } catch (error) {
      log(`Error getting user by email: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
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
    } catch (error) {
      log(`Error creating user: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async getUserSubjects(userId: number): Promise<StudentSubject[]> {
    try {
      log(`Getting subjects for user: ${userId}`);
      const results = await db
        .select()
        .from(studentSubjects)
        .where(eq(studentSubjects.user_id, userId));
      log(`Found ${results.length} subjects for user`);
      return results;
    } catch (error) {
      log(`Error getting user subjects: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async createUserSubjects(userId: number, childName: string, subjects: string[], grade: number, preferredEmailTime: string = "09:00 AM"): Promise<StudentSubject[]> {
    try {
      log(`Creating subjects for user ${userId}: ${subjects.join(', ')}`);
      const subjectEntries = subjects.map(subject => ({
        user_id: userId,
        childName,
        subject,
        grade,
        lastQuestionDate: new Date().toISOString(),
        preferredEmailTime: preferredEmailTime // Use the provided time parameter
      }));

      const result = await db
        .insert(studentSubjects)
        .values(subjectEntries)
        .returning();
      log(`Created ${result.length} subjects for user`);
      return result;
    } catch (error) {
      log(`Error creating user subjects: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async updateStripeCustomerId(userId: number, customerId: string): Promise<User> {
    try {
      const result = await db
        .update(users)
        .set({ stripeCustomerId: customerId })
        .where(eq(users.user_id, userId))
        .returning();
      return result[0];
    } catch (error) {
      log(`Error updating stripe customer id: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
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
        .where(eq(users.user_id, userId))
        .returning();
      return result[0];
    } catch (error) {
      log(`Error updating user stripe info: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async getUserByStripeCustomerId(customerId: string): Promise<User | undefined> {
    try {
      const results = await db
        .select()
        .from(users)
        .where(eq(users.stripeCustomerId, customerId));
      return results[0];
    } catch (error) {
      log(`Error getting user by Stripe customer ID: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async updateSubscriptionStatus(userId: number, isSubscribed: boolean): Promise<User> {
    try {
      const result = await db
        .update(users)
        .set({ isSubscribed })
        .where(eq(users.user_id, userId))
        .returning();
      return result[0];
    } catch (error) {
      log(`Error updating subscription status: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}

export const storage = new DatabaseStorage();