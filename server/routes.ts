import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertProfileSchema } from "@shared/schema";
import { getDailyQuestions } from "./questions";
import { sendDailyQuestions } from "./email";
import { log } from "./vite";
import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16" as const,
});

// Store active intervals by user ID
const activeIntervals = new Map<number, NodeJS.Timeout>();

// Add type safety for subscription response
interface StripeSubscriptionResponse {
  subscriptionId: string;
  clientSecret: string;
}

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  app.post('/api/get-or-create-subscription', async (req, res) => {
    if (!stripe) {
      return res.status(503).json({ message: "Subscription service temporarily unavailable" });
    }

    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = req.user;

    try {
      // Check existing subscription
      if (user.stripeSubscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
        const paymentIntent = await stripe.paymentIntents.retrieve(
          (subscription.latest_invoice as Stripe.Invoice).payment_intent as string
        );

        const response: StripeSubscriptionResponse = {
          subscriptionId: subscription.id,
          clientSecret: paymentIntent.client_secret as string,
        };
        res.json(response);
        return;
      }

      // Create new customer and subscription
      const customer = await stripe.customers.create({
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
      });

      if (!process.env.STRIPE_PRICE_ID) {
        throw new Error('STRIPE_PRICE_ID is not configured');
      }

      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{
          price: process.env.STRIPE_PRICE_ID,
        }],
        payment_behavior: 'default_incomplete',
        payment_settings: {
          payment_method_types: ['card'],
          save_default_payment_method: 'on_subscription',
        },
        expand: ['latest_invoice.payment_intent'],
      });

      // Update user with Stripe info
      await storage.updateUserStripeInfo(user.id, {
        customerId: customer.id,
        subscriptionId: subscription.id
      });

      const invoice = subscription.latest_invoice as Stripe.Invoice;
      const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;

      if (!paymentIntent?.client_secret) {
        throw new Error('Failed to create payment intent');
      }

      const response: StripeSubscriptionResponse = {
        subscriptionId: subscription.id,
        clientSecret: paymentIntent.client_secret,
      };

      res.json(response);
    } catch (error: any) {
      log(`Subscription error: ${error.message}`);
      res.status(400).json({ 
        error: { 
          message: error.message || 'Failed to create subscription'
        } 
      });
    }
  });

  // Add test endpoint without authentication for initial testing
  app.post('/api/test-email-no-auth', async (req, res) => {
    try {
      log("Testing email functionality without auth...");
      const testQuestions = getDailyQuestions("math", 5, 2);
      const questionsBySubject = { math: testQuestions };

      // Attempt to send email with clear test subject
      await sendDailyQuestions(
        "aub204@yahoo.com",  // Using the actual user email
        "EduQuest User",     // More professional name
        questionsBySubject
      );

      res.json({ 
        message: "Test email sent successfully",
        sentTo: "aub204@yahoo.com",
        emailType: "Daily Learning Questions"
      });
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