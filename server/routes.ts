import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertProfileSchema } from "@shared/schema";

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

    // Get 20 questions for each selected subject
    const questionsBySubject = {};
    for (const subject of profile.subjects) {
      const questions = await storage.getDailyQuestions(subject, profile.grade);
      questionsBySubject[subject] = questions.slice(0, 20);
    }

    // TODO: Send email with questions
    // We'll need to set up SendGrid to implement this
    // For now, just return the questions grouped by subject
    res.json(questionsBySubject);
  });

  // Subscription route - disabled when Stripe is not configured
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