import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertProfileSchema } from "@shared/schema";
import { getDailyQuestions } from "./questions";
import { sendDailyQuestions } from "./email";
import { log } from "./vite";

let stripe: any;
try {
  if (process.env.STRIPE_SECRET_KEY) {
    const Stripe = require("stripe");
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2023-10-16",
    });
  }
} catch (error) {
  console.warn("Stripe integration disabled - missing configuration");
}

// Store active intervals by user ID
const activeIntervals = new Map<number, NodeJS.Timeout>();

// Function to send questions to a specific user
async function sendQuestionsToUser(userId: number) {
  try {
    log(`Starting periodic questions task for user ${userId}`);
    const user = await storage.getUser(userId);
    const profile = await storage.getStudentProfile(userId);

    if (!user || !profile) {
      log(`Cannot send questions: User ${userId} or profile not found`);
      return;
    }

    log(`Generating questions for user ${userId} (${user.email})`);

    // Generate new questions for each subject
    const questionsBySubject: Record<string, any> = {};
    for (const subject of profile.subjects) {
      const questions = getDailyQuestions(subject, profile.grade, 20);
      questionsBySubject[subject] = questions;
      log(`Generated ${questions.length} questions for ${subject}`);
    }

    // Send email with questions
    try {
      log(`Attempting to send email to ${user.email}`);
      await sendDailyQuestions(
        user.email,
        user.firstName,
        questionsBySubject
      );
      log(`Successfully sent periodic questions email to ${user.email}`);
    } catch (error) {
      log(`Failed to send periodic questions email to ${user.email}: ${error}`);
    }
  } catch (error) {
    log(`Error in periodic questions task for user ${userId}: ${error}`);
  }
}

// Function to start periodic questions for a user
function startPeriodicQuestions(userId: number) {
  // Clear any existing interval
  if (activeIntervals.has(userId)) {
    clearInterval(activeIntervals.get(userId));
    activeIntervals.delete(userId);
    log(`Cleared existing periodic questions for user ${userId}`);
  }

  // Create new interval - send every 1 minute
  log(`Starting new periodic questions interval for user ${userId}`);
  const interval = setInterval(() => {
    log(`Triggering periodic questions for user ${userId}`);
    sendQuestionsToUser(userId);
  }, 60000); // Every minute

  activeIntervals.set(userId, interval);

  // Send the first batch immediately
  log(`Sending initial questions for user ${userId}`);
  sendQuestionsToUser(userId);

  log(`Started periodic questions for user ${userId}`);
}

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  // Add test endpoint without authentication for initial testing
  app.post('/api/test-email-no-auth', async (req, res) => {
    try {
      log("Testing email functionality without auth...");
      const testQuestions = getDailyQuestions("math", 5, 2);
      const questionsBySubject = { math: testQuestions };

      // Attempt to send email
      await sendDailyQuestions(
        "test@example.com",
        "Test User",
        questionsBySubject
      );

      res.json({ message: "Test email sent successfully" });
    } catch (error: any) {
      log(`Test email failed: ${error.message}`);
      res.status(500).json({ 
        error: "Failed to send test email",
        details: error.message 
      });
    }
  });

  // Add test endpoint for email functionality
  app.post('/api/test-email', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    try {
      log("Testing email functionality...");
      const profile = await storage.getStudentProfile(req.user.id);
      if (!profile) {
        return res.status(404).json({ error: "Profile not found" });
      }

      // Generate test questions
      const testQuestions = getDailyQuestions("math", profile.grade, 2);
      const questionsBySubject = { math: testQuestions };

      // Attempt to send email
      await sendDailyQuestions(
        req.user.email,
        req.user.firstName,
        questionsBySubject
      );

      res.json({ message: "Test email sent successfully" });
    } catch (error: any) {
      log(`Test email failed: ${error.message}`);
      res.status(500).json({ 
        error: "Failed to send test email",
        details: error.message 
      });
    }
  });

  // Student profile routes
  app.post('/api/profile', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const data = insertProfileSchema.parse(req.body);
      const profile = await storage.createStudentProfile({
        ...data,
        userId: req.user.id,
        lastQuestionDate: new Date().toISOString(),
      });

      // Start sending periodic questions to this user
      startPeriodicQuestions(req.user.id);

      res.json(profile);
    } catch (err) {
      res.status(400).json({ error: "Invalid profile data" });
    }
  });

  app.get('/api/profile', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const profile = await storage.getStudentProfile(req.user.id);
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    // Start sending periodic questions to this user
    startPeriodicQuestions(req.user.id);

    res.json(profile);
  });

  app.get('/api/questions', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const profile = await storage.getStudentProfile(req.user.id);
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    // Generate new questions for each subject
    const questionsBySubject: Record<string, any> = {};
    for (const subject of profile.subjects) {
      const questions = getDailyQuestions(subject, profile.grade, 20);
      questionsBySubject[subject] = questions;
    }

    try {
      // Send email with questions
      await sendDailyQuestions(
        req.user.email,
        req.user.firstName,
        questionsBySubject
      );
      log(`Questions email sent to ${req.user.email}`);
    } catch (error) {
      log(`Failed to send questions email: ${error}`);
      // Continue even if email fails - don't block the API response
    }

    res.json(questionsBySubject);
  });

  app.post('/api/get-or-create-subscription', async (req, res) => {
    if (!stripe) {
      return res.status(503).json({ 
        message: "Subscription service temporarily unavailable" 
      });
    }

    if (!req.isAuthenticated()) {
      return res.status(401).send("Not authenticated");
    }

    const user = req.user;

    if (user.stripeSubscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
      res.send({
        subscriptionId: subscription.id,
        clientSecret: subscription.latest_invoice?.payment_intent?.client_secret,
      });
      return;
    }

    try {
      const customer = await stripe.customers.create({
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
      });

      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{
          price: process.env.STRIPE_PRICE_ID,
        }],
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
      });

      await storage.updateUserStripeInfo(user.id, {
        customerId: customer.id,
        subscriptionId: subscription.id
      });

      res.send({
        subscriptionId: subscription.id,
        clientSecret: subscription.latest_invoice.payment_intent.client_secret,
      });
    } catch (error: any) {
      res.status(400).send({ error: { message: error.message } });
    }
  });

  // Cleanup intervals on logout
  app.post("/api/logout", (req, res, next) => {
    if (req.user?.id && activeIntervals.has(req.user.id)) {
      clearInterval(activeIntervals.get(req.user.id));
      activeIntervals.delete(req.user.id);
      log(`Cleared periodic questions for user ${req.user.id}`);
    }
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  const httpServer = createServer(app);
  return httpServer;
}