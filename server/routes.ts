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

// Function to send questions to a specific user
async function sendQuestionsToUser(userId: number) {
  try {
    const user = await storage.getUser(userId);
    const profile = await storage.getStudentProfile(userId);

    if (!user || !profile) {
      log(`Cannot send questions: User ${userId} or profile not found`);
      return;
    }

    // Generate new questions for each subject
    const questionsBySubject: Record<string, any> = {};
    for (const subject of profile.subjects) {
      const questions = getDailyQuestions(subject, profile.grade, 20);
      questionsBySubject[subject] = questions;
    }

    // Send email with questions
    try {
      await sendDailyQuestions(
        user.email,
        user.firstName,
        questionsBySubject
      );
      log(`Periodic questions email sent to ${user.email}`);
    } catch (error) {
      log(`Failed to send periodic questions email to ${user.email}: ${error}`);
    }
  } catch (error) {
    log(`Error in periodic questions task for user ${userId}: ${error}`);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

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
      setInterval(() => sendQuestionsToUser(req.user.id), 60000); // Every minute

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
    setInterval(() => sendQuestionsToUser(req.user.id), 60000); // Every minute

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
      // Send email with the questions
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

  // Subscription routes remain unchanged
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
        clientSecret: (subscription.latest_invoice as any).payment_intent.client_secret,
      });
    } catch (error: any) {
      res.status(400).send({ error: { message: error.message } });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}