import * as SibApiV3Sdk from '@sendinblue/client';
import type { Question } from "@shared/schema";
import { log } from "./vite";

if (!process.env.BREVO_API_KEY) {
  log("Warning: BREVO_API_KEY not set. Email functionality will be disabled.");
} else {
  log("BREVO_API_KEY is set and available");
}

let apiInstance: SibApiV3Sdk.TransactionalEmailsApi | null = null;

// Initialize the API client properly
try {
  log("Initializing Brevo API client...");
  const defaultClient = SibApiV3Sdk.ApiClient.instance;
  if (!defaultClient.authentications['api-key']) {
    defaultClient.authentications['api-key'] = { apiKey: process.env.BREVO_API_KEY || '' };
  } else {
    defaultClient.authentications['api-key'].apiKey = process.env.BREVO_API_KEY || '';
  }
  apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
  log("Brevo API client initialized successfully");
} catch (error) {
  log(`Error initializing Brevo API client: ${error}`);
}

export async function sendDailyQuestions(
  email: string, 
  firstName: string,
  questionsBySubject: Record<string, Question[]>
) {
  if (!process.env.BREVO_API_KEY || !apiInstance) {
    log("Cannot send email: BREVO_API_KEY not set or client initialization failed");
    return;
  }

  log(`Preparing to send email to ${email}`);

  const formatQuestions = (questions: Question[]) => {
    return questions.map((q, index) => `
      Question ${index + 1}: ${q.question}
      Answer: ${q.answer}
      ${q.explanation ? `Explanation: ${q.explanation}` : ''}
      -------------------
    `).join('\n');
  };

  let emailContent = `Hello ${firstName}!\n\nHere are your daily learning questions:\n\n`;

  Object.entries(questionsBySubject).forEach(([subject, questions]) => {
    log(`Processing ${questions.length} questions for subject: ${subject}`);
    emailContent += `\n${subject.toUpperCase()}\n`;
    emailContent += formatQuestions(questions);
    emailContent += '\n';
  });

  emailContent += '\nGood luck with your learning journey!\n';

  try {
    log("Creating email payload...");
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.subject = "Your Daily Learning Questions";
    sendSmtpEmail.htmlContent = emailContent.replace(/\n/g, '<br>');
    sendSmtpEmail.sender = { name: "EduQuest", email: "noreply@eduquest.com" };
    sendSmtpEmail.to = [{ email: email, name: firstName }];

    log("Sending email via Brevo...");
    await apiInstance.sendTransacEmail(sendSmtpEmail);
    log(`Daily questions email sent successfully to ${email}`);
  } catch (error) {
    log(`Error sending email to ${email}: ${error}`);
    throw error;
  }
}