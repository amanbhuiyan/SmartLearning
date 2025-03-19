import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { Question, insertProfileSchema } from "@shared/schema";
import { log } from "./vite";
import { db } from "./db";
import { questions } from "@shared/schema";
import { eq } from "drizzle-orm";

async function getDailyQuestions(subject: string, grade: number, count: number = 20): Promise<Question[]> {
  try {
    log(`Getting ${count} questions for subject: ${subject}, grade: ${grade}`);
    const results = await db
      .select()
      .from(questions)
      .where(eq(questions.subject, subject))
      .where(eq(questions.grade, grade))
      .limit(count);

    if (results.length < count) {
      log(`Warning: Only found ${results.length} questions for subject ${subject}, grade ${grade}. Expected ${count} questions.`);
    }

    return results;
  } catch (err) {
    log(`Error getting questions: ${err}`);
    throw new Error(`Failed to get questions for subject ${subject}, grade ${grade}: ${err}`);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  app.post('/api/profile', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const data = insertProfileSchema.parse(req.body);

      // Create a subject entry for each selected subject
      const subjects = await storage.createUserSubjects(
        req.user.user_id,
        data.subjects,
        data.grade
      );

      res.json(subjects);
    } catch (err) {
      log(`Error creating profile: ${err instanceof Error ? err.message : String(err)}`);
      res.status(400).json({ error: "Invalid profile data" });
    }
  });

  app.get('/api/profile', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const subjects = await storage.getUserSubjects(req.user.user_id);
      if (!subjects.length) {
        return res.status(404).json({ error: "Profile not found" });
      }

      // Transform the subjects array into the expected format
      const profile = {
        userId: req.user.user_id,
        subjects: [...new Set(subjects.map(s => s.subject))],
        grade: subjects[0].grade,
        lastQuestionDate: subjects[0].lastQuestionDate
      };

      res.json(profile);
    } catch (err) {
      log(`Error fetching profile: ${err instanceof Error ? err.message : String(err)}`);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  app.get('/api/questions', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const userSubjects = await storage.getUserSubjects(req.user.user_id);
      if (!userSubjects.length) {
        return res.status(404).json({ error: "Profile not found" });
      }

      const questionsBySubject: Record<string, Question[]> = {};

      // Get questions for each subject
      for (const subjectRecord of userSubjects) {
        const questions = await getDailyQuestions(
          subjectRecord.subject,
          subjectRecord.grade
        );

        if (questions.length > 0) {
          questionsBySubject[subjectRecord.subject] = questions;
          log(`Generated ${questions.length} questions for ${subjectRecord.subject} (Grade ${subjectRecord.grade})`);
        }
      }

      if (Object.keys(questionsBySubject).length === 0) {
        return res.status(404).json({ 
          error: "No questions available for your selected grade level and subjects" 
        });
      }

      res.json(questionsBySubject);
    } catch (error) {
      log(`Error fetching questions: ${error}`);
      res.status(500).json({ error: "Failed to fetch questions" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}