import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { Question, insertProfileSchema } from "@shared/schema";
import { sendDailyQuestions } from "./email";
import { log } from "./vite";
import Stripe from 'stripe';
import { db } from "./db";
import { users, questions } from "@shared/schema";
import { eq } from "drizzle-orm";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

// Store active intervals by user ID
const activeIntervals = new Map<number, NodeJS.Timeout>();

// Email Queue Implementation
class EmailQueue {
  private queue: number[] = [];  // Store user IDs
  private isProcessing = false;

  // Add a user to the queue
  enqueue(userId: number) {
    if (!this.queue.includes(userId)) {
      log(`Adding user ${userId} to email queue`);
      this.queue.push(userId);
      this.startProcessing();
    }
  }

  // Start processing the queue if not already processing
  private startProcessing() {
    if (!this.isProcessing && this.queue.length > 0) {
      log('Starting queue processing');
      this.isProcessing = true;
      this.processNextInQueue();
    }
  }

  // Process the next user in the queue with a 30-second delay
  private async processNextInQueue() {
    if (this.queue.length === 0) {
      log('Queue processing complete - no more users in queue');
      this.isProcessing = false;
      return;
    }

    const userId = this.queue.shift();
    if (!userId) {
      this.isProcessing = false;
      return;
    }

    try {
      log(`Processing emails for user ${userId}`);
      const user = await db.select().from(users).where(eq(users.id, userId)).then(rows => rows[0]);

      if (!user) {
        log(`User ${userId} not found - skipping`);
        setTimeout(() => this.processNextInQueue(), 30000); // Wait 30 seconds before next user
        return;
      }

      const isInTrialPeriod = user.trialEndsAt && new Date(user.trialEndsAt) > new Date();
      const isSubscribed = user.isSubscribed && user.stripeSubscriptionId;

      if (isInTrialPeriod || isSubscribed) {
        const profile = await storage.getStudentProfile(user.id);

        if (profile) {
          log(`Processing eligible user ${user.id} (${user.email}) with profile`);

          // Generate questions for each subject
          const questionsBySubject: Record<string, Question[]> = {};
          let hasValidQuestions = true;

          for (const subject of profile.subjects) {
            const questions = await getDailyQuestions(subject, profile.grade, 20);

            // Validate if we have enough questions for this grade and subject
            if (questions.length === 0) {
              log(`Error: No questions found for subject ${subject}, grade ${profile.grade}`);
              hasValidQuestions = false;
              break;
            }

            questionsBySubject[subject] = questions;
            log(`Generated ${questions.length} questions for ${subject} (Grade ${profile.grade})`);
          }

          // Only send email if we have valid questions for all subjects
          if (hasValidQuestions) {
            try {
              await sendDailyQuestions(
                user.email,
                user.firstName,
                questionsBySubject
              );
              log(`Successfully sent questions email to ${user.email}`);
            } catch (error) {
              log(`Failed to send email to ${user.email}: ${error}`);
            }
          } else {
            log(`Skipping email for user ${user.email} due to missing questions for their grade/subjects`);
          }
        } else {
          log(`Eligible user ${user.id} has no profile yet`);
        }
      } else {
        log(`User ${user.id} (${user.email}) is not eligible for emails`);
      }
    } catch (err) {
      log(`Error processing user ${userId}: ${err}`);
    }

    // Schedule processing of next user after 30 seconds
    log(`Waiting 30 seconds before processing next user in queue`);
    setTimeout(() => this.processNextInQueue(), 30000);
  }
}

// Create a single instance of EmailQueue
const emailQueue = new EmailQueue();

// Function to send questions to all eligible users
async function sendQuestionsToAllEligibleUsers() {
  // If we're already processing emails, skip this run
  if (isProcessingEmails) {
    log('Email processing already in progress, skipping this interval');
    return;
  }

  try {
    isProcessingEmails = true;
    log('Starting to add eligible users to email queue');

    // Get all users from the database
    const results = await db.select().from(users);

    for (const user of results) {
      log(`Adding user ${user.id} (${user.email}) to queue`);
      emailQueue.enqueue(user.id);
    }

    log(`Added ${results.length} users to email queue`);
  } catch (err) {
    log(`Error in sendQuestionsToAllEligibleUsers: ${err}`);
  } finally {
    isProcessingEmails = false;
  }
}

// Flag to track if we're currently processing emails
let isProcessingEmails = false;

// Initialize global email interval
let globalEmailInterval: NodeJS.Timeout | null = null;

// Function to start global email interval
function startGlobalEmailInterval() {
  if (globalEmailInterval) {
    clearInterval(globalEmailInterval);
    log('Cleared existing global email interval');
  }

  log('Starting new global email interval - emails will be sent every 5 minutes');
  globalEmailInterval = setInterval(sendQuestionsToAllEligibleUsers, 5 * 60 * 1000);
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

    try {
      const profile = await storage.getStudentProfile(req.user.id);
      if (!profile) {
        return res.status(404).json({ error: "Profile not found" });
      }

      const questionsBySubject: Record<string, Question[]> = {};
      let hasValidQuestions = true;

      // Validate subject access
      for (const subject of profile.subjects) {
        const questions = await getDailyQuestions(subject, profile.grade, 20);

        // Strict validation: ensure we have questions and they match the exact grade level
        if (questions.length === 0) {
          log(`Error: No questions found for subject ${subject}, grade ${profile.grade}`);
          hasValidQuestions = false;
          break;
        }

        // Additional validation to ensure grade level match
        const validGradeQuestions = questions.filter(q => q.grade === profile.grade);
        if (validGradeQuestions.length === 0) {
          log(`Error: No questions found for exact grade ${profile.grade} in subject ${subject}`);
          hasValidQuestions = false;
          break;
        }

        questionsBySubject[subject] = validGradeQuestions;
        log(`Generated ${validGradeQuestions.length} questions for ${subject} (Grade ${profile.grade})`);
      }

      if (!hasValidQuestions) {
        return res.status(404).json({ 
          error: "No questions available for your selected grade level and subjects" 
        });
      }

      // Only try to send email if we have valid questions
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
    } catch (error) {
      log(`Error fetching questions: ${error}`);
      res.status(500).json({ error: "Failed to fetch questions" });
    }
  });

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
      const testQuestions = await getDailyQuestions("math", 5, 2);
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
      const testQuestions = await getDailyQuestions("math", profile.grade, 2);
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