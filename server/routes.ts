import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertProfileSchema, Question } from "@shared/schema";
import { getDailyQuestions } from "./questions";
import { sendDailyQuestions } from "./email";
import { log } from "./vite";
import Stripe from 'stripe';
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

// Store active intervals by user ID
const activeIntervals = new Map<number, NodeJS.Timeout>();

// Function to send questions to all eligible users
async function sendQuestionsToAllEligibleUsers() {
  try {
    log('Starting to send questions to all eligible users');

    // Get all users from the database
    const results = await db.select().from(users);
    let emailsSent = 0;

    for (const user of results) {
      try {
        log(`User ${user.id} (${user.email}) eligibility check:
          Trial ends: ${user.trialEndsAt}
          Is subscribed: ${user.isSubscribed}
          Has subscription ID: ${!!user.stripeSubscriptionId}
        `);

        const isInTrialPeriod = user.trialEndsAt && new Date(user.trialEndsAt) > new Date();
        const isSubscribed = user.isSubscribed && user.stripeSubscriptionId;

        if (isInTrialPeriod || isSubscribed) {
          const profile = await storage.getStudentProfile(user.id);

          if (profile) {
            log(`Processing eligible user ${user.id} (${user.email}) with profile`);

            // Generate questions for each subject
            const questionsBySubject: Record<string, Question[]> = {};
            for (const subject of profile.subjects) {
              const questions = getDailyQuestions(subject, profile.grade, 20);
              questionsBySubject[subject] = questions;
              log(`Generated ${questions.length} questions for ${subject}`);
            }

            // Send email
            try {
              await sendDailyQuestions(
                user.email,
                user.firstName,
                questionsBySubject
              );
              emailsSent++;
              log(`Successfully sent questions email to ${user.email} (Total sent: ${emailsSent})`);
            } catch (error) {
              log(`Failed to send email to ${user.email}: ${error}`);
            }
          } else {
            log(`Eligible user ${user.id} has no profile yet`);
          }
        } else {
          log(`User ${user.id} (${user.email}) is not eligible for emails`);
        }
      } catch (error) {
        log(`Error processing user ${user.id}: ${error}`);
      }
    }

    log(`Email sending batch completed. Total emails sent: ${emailsSent}`);
  } catch (error) {
    log(`Error in sendQuestionsToAllEligibleUsers: ${error}`);
  }
}

// Initialize global email sending interval
let globalEmailInterval: NodeJS.Timeout | null = null;

// Function to start periodic questions for all users
function startGlobalEmailInterval() {
  if (globalEmailInterval) {
    clearInterval(globalEmailInterval);
    log('Cleared existing global email interval');
  }

  log('Starting new global email interval');
  globalEmailInterval = setInterval(sendQuestionsToAllEligibleUsers, 5 * 60 * 1000);

  // Start first batch after 1 minute
  setTimeout(sendQuestionsToAllEligibleUsers, 60 * 1000);
  log('Global email interval set up. First batch will be sent in 1 minute, then every 5 minutes.');
}

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  // Start the global email interval when the server starts
  startGlobalEmailInterval();

  app.post('/api/get-or-create-subscription', async (req, res) => {
    try {
      if (!stripe) {
        throw new Error("Subscription service temporarily unavailable");
      }

      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = req.user;

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

    const questionsBySubject: Record<string, Question[]> = {};
    for (const subject of profile.subjects) {
      const questions = getDailyQuestions(subject, profile.grade, 20);
      questionsBySubject[subject] = questions;
    }

    try {
      await sendDailyQuestions(
        req.user.email,
        req.user.firstName,
        questionsBySubject
      );
      log(`Questions email sent to ${req.user.email}`);
    } catch (error) {
      log(`Failed to send questions email: ${error}`);
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
  // Add a webhook handler for Stripe events
  app.post('/api/stripe-webhook', async (req, res) => {
    const sig = req.headers['stripe-signature'];

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig as string,
        process.env.STRIPE_WEBHOOK_SECRET as string
      );
    } catch (err: any) {
      log(`Webhook Error: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        // Update user subscription status
        try {
          const subscription = await stripe.subscriptions.retrieve(paymentIntent.metadata.subscriptionId);
          const user = await storage.getUser(parseInt(paymentIntent.metadata.userId));
          if (user) {
            await storage.updateUserStripeInfo(user.id, {
              customerId: subscription.customer as string,
              subscriptionId: subscription.id,
            });
          }
        } catch (error) {
          log(`Error updating subscription status: ${error}`);
        }
        break;
      case 'customer.subscription.deleted':
        const subscription = event.data.object;
        // Handle subscription cancellation
        try {
          const user = await storage.getUserByStripeCustomerId(subscription.customer as string);
          if (user) {
            await storage.updateSubscriptionStatus(user.id, false);
          }
        } catch (error) {
          log(`Error handling subscription deletion: ${error}`);
        }
        break;
      default:
        log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  });

  const httpServer = createServer(app);
  return httpServer;
}

interface StripeSubscriptionResponse {
  subscriptionId: string;
  clientSecret: string;
}