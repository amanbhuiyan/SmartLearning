import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { Question, insertProfileSchema } from "@shared/schema";
import { log } from "./vite";
import { getDailyQuestions } from "./questions";

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
        subjects: subjects.map(s => s.subject), // Changed to handle multiple subjects
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

      // Generate fresh questions for each subject
      for (const subjectRecord of userSubjects) {
        log(`Generating questions for subject: ${subjectRecord.subject}, grade: ${subjectRecord.grade}`);

        // Generate questions for this subject
        const subjectQuestions = getDailyQuestions(
          subjectRecord.subject,
          subjectRecord.grade,
          20 // Generate 20 questions per subject
        );

        // Add questions to the subject map
        questionsBySubject[subjectRecord.subject] = subjectQuestions;
        log(`Generated ${subjectQuestions.length} questions for ${subjectRecord.subject} (Grade ${subjectRecord.grade})`);
      }

      // Verify we have questions for all subjects
      const subjectsWithQuestions = Object.keys(questionsBySubject);
      log(`Generated questions for subjects: ${subjectsWithQuestions.join(', ')}`);

      if (subjectsWithQuestions.length !== userSubjects.length) {
        log(`Warning: Not all subjects have questions. Expected ${userSubjects.length} subjects, got ${subjectsWithQuestions.length}`);
      }

      res.json(questionsBySubject);
    } catch (error) {
      log(`Error generating questions: ${error}`);
      res.status(500).json({ error: "Failed to generate questions" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}