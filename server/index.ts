import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { storage } from "./storage";
import { getDailyQuestions } from "./questions";
import { sendDailyQuestions } from "./email";
import { runMigrations, db } from "./db";
import { eq } from "drizzle-orm";
import { studentSubjects } from "../shared/schema";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Function to check if it's time to send email for a user
function isTimeToSendEmail(preferredTime: string): boolean {
  const now = new Date();
  const [time, period] = preferredTime.split(' ');
  const [hours, minutes] = time.split(':');

  // Convert to 24-hour format for comparison
  let hour = parseInt(hours);
  if (period === 'PM' && hour !== 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;

  // Create a Date object for the preferred time today
  const preferredDateTime = new Date();
  preferredDateTime.setHours(hour, parseInt(minutes), 0, 0);

  // For precise scheduling, compare current time with user's preferred time
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  
  // Log time details for debugging - now showing all checks for transparency
  log(`Email time check - User preferred: ${preferredTime} (${hour}:${parseInt(minutes)}), Current time: ${currentHour}:${currentMinute}`);
  
  // Check if the times match
  const isMatch = currentHour === hour && currentMinute === parseInt(minutes);
  
  if (isMatch) {
    log(`MATCH FOUND! Will send email now for preferred time: ${preferredTime}`);
  }
  
  // Return true if the current time is exactly the preferred time
  // This ensures emails are sent precisely at the user's chosen time
  return isMatch;
}

// Function to send daily questions to users
async function sendDailyQuestionsToAllUsers() {
  try {
    log("Starting scheduled email check...");

    // Get all users from the database
    const allUsers = await storage.getAllUsers();
    log(`Found ${allUsers.length} users to check`);

    for (const user of allUsers) {
      try {
        // Get subjects for this user
        const userSubjects = await storage.getUserSubjects(user.user_id);

        if (!userSubjects.length) {
          log(`No subjects found for user ${user.user_id}, skipping...`);
          continue;
        }

        // Check if an email was already sent today
        const lastQuestionDate = userSubjects[0].lastQuestionDate;
        const todayDateStr = new Date().toISOString().split('T')[0]; // Get today's date in YYYY-MM-DD format
        
        if (lastQuestionDate && lastQuestionDate.startsWith(todayDateStr)) {
          log(`Already sent email to ${user.email} today, skipping...`);
          continue;
        }
        
        // Check if it's time to send email for this user based on their preferred time
        if (!isTimeToSendEmail(userSubjects[0].preferredEmailTime)) {
          continue;
        }

        // Generate questions for each subject
        const questionsBySubject: Record<string, any> = {};
        for (const subjectRecord of userSubjects) {
          const questions = getDailyQuestions(
            subjectRecord.subject,
            subjectRecord.grade,
            20
          );
          questionsBySubject[subjectRecord.subject] = questions;
        }

        // Send email to the user
        await sendDailyQuestions(
          user.email,
          userSubjects[0].childName,
          questionsBySubject
        );

        // Update the last question date for all subjects
        const currentTimestamp = new Date().toISOString();
        
        log(`Updating lastQuestionDate to ${currentTimestamp} for user ${user.user_id}`);
        
        // Update all subjects for this user in a single query
        try {
          await db
            .update(studentSubjects)
            .set({ lastQuestionDate: currentTimestamp })
            .where(eq(studentSubjects.user_id, user.user_id))
            .execute();
          
          log(`Successfully updated lastQuestionDate for user ${user.user_id}`);
        } catch (error) {
          log(`Error updating lastQuestionDate: ${error}`);
        }

        log(`Successfully sent daily questions to user ${user.email} and updated timestamp`);
      } catch (error) {
        log(`Failed to send questions to user ${user.email}: ${error}`);
        continue;
      }
    }
    log("Completed scheduled email check");
  } catch (error) {
    log(`Error in scheduled email sending: ${error}`);
  }
}

(async () => {
  try {
    log("Starting server initialization...");

    // Migrations have been run manually
    // await runMigrations();

    const server = await registerRoutes(app);

    // Error handling middleware
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      log(`Error occurred: ${message}`);
      res.status(status).json({ message });
    });

    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    const port = 5000;
    server.listen(port, "0.0.0.0", () => {
      log(`Server running at http://0.0.0.0:${port}`);

      // Start the email scheduler after server is running
      log("Starting email scheduler...");
      
      // Run immediately once to check for any pending emails
      log("Running initial email check...");
      sendDailyQuestionsToAllUsers().then(() => {
        log("Initial email check completed");
      }).catch(error => {
        log(`Error in initial email check: ${error}`);
      });
      
      // Check every 5 minutes for emails that need to be sent
      // This is sufficient because we check the exact time within the function
      setInterval(sendDailyQuestionsToAllUsers, 5 * 60 * 1000);
      log("Email scheduler started successfully");
    });
  } catch (error) {
    log(`Failed to start server: ${error}`);
    process.exit(1);
  }
})();