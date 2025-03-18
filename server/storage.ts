import { User, StudentProfile, Question, InsertUser } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

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

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private profiles: Map<number, StudentProfile>;
  private questions: Question[];
  sessionStore: session.Store;
  currentId: number;

  constructor() {
    this.users = new Map();
    this.profiles = new Map();
    this.questions = this.generateSampleQuestions();
    this.currentId = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId++;
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 7);

    const user: User = { 
      ...insertUser, 
      id,
      isSubscribed: false,
      trialEndsAt,
      stripeCustomerId: null,
      stripeSubscriptionId: null
    };
    this.users.set(id, user);
    return user;
  }

  async updateStripeCustomerId(userId: number, customerId: string): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) throw new Error("User not found");

    const updated = { ...user, stripeCustomerId: customerId };
    this.users.set(userId, updated);
    return updated;
  }

  async updateUserStripeInfo(userId: number, info: { customerId: string, subscriptionId: string }): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) throw new Error("User not found");

    const updated = { 
      ...user, 
      stripeCustomerId: info.customerId,
      stripeSubscriptionId: info.subscriptionId,
      isSubscribed: true
    };
    this.users.set(userId, updated);
    return updated;
  }

  async getStudentProfile(userId: number): Promise<StudentProfile | undefined> {
    return Array.from(this.profiles.values()).find(
      (profile) => profile.userId === userId
    );
  }

  async createStudentProfile(profile: Omit<StudentProfile, "id">): Promise<StudentProfile> {
    const id = this.currentId++;
    const newProfile = { ...profile, id };
    this.profiles.set(id, newProfile);
    return newProfile;
  }

  async getDailyQuestions(subject: string, grade: number): Promise<Question[]> {
    return this.questions
      .filter(q => q.subject === subject && q.grade === grade)
      .slice(0, 20);
  }

  private generateSampleQuestions(): Question[] {
    const questions: Question[] = [];
    const subjects = ['math', 'english'];
    const grades = [1, 2, 3, 4, 5, 6];

    let id = 1;
    for (const subject of subjects) {
      for (const grade of grades) {
        for (let i = 0; i < 30; i++) {
          questions.push({
            id: id++,
            subject,
            grade,
            question: `Sample ${subject} question ${i + 1} for grade ${grade}`,
            answer: `Sample answer ${i + 1}`,
            explanation: `Sample explanation ${i + 1}`
          });
        }
      }
    }

    return questions;
  }
}

export const storage = new MemStorage();