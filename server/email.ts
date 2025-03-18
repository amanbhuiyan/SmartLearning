import * as SibApiV3Sdk from '@sendinblue/client';
import type { Question } from "@shared/schema";
import { log } from "./vite";

if (!process.env.BREVO_API_KEY) {
  log("Warning: BREVO_API_KEY not set. Email functionality will be disabled.");
}

// Initialize the API client properly
const apiClient = new SibApiV3Sdk.ApiClient();
apiClient.authentications['api-key'].apiKey = process.env.BREVO_API_KEY || '';
const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi(apiClient);

export async function sendDailyQuestions(
  email: string, 
  firstName: string,
  questionsBySubject: Record<string, Question[]>
) {
  if (!process.env.BREVO_API_KEY) {
    log("Cannot send email: BREVO_API_KEY not set");
    return;
  }

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
    emailContent += `\n${subject.toUpperCase()}\n`;
    emailContent += formatQuestions(questions);
    emailContent += '\n';
  });

  emailContent += '\nGood luck with your learning journey!\n';

  const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
  sendSmtpEmail.subject = "Your Daily Learning Questions";
  sendSmtpEmail.htmlContent = emailContent.replace(/\n/g, '<br>');
  sendSmtpEmail.sender = { name: "EduQuest", email: "noreply@eduquest.com" };
  sendSmtpEmail.to = [{ email: email, name: firstName }];

  try {
    await apiInstance.sendTransacEmail(sendSmtpEmail);
    log(`Daily questions email sent successfully to ${email}`);
  } catch (error) {
    log(`Error sending email to ${email}: ${error}`);
    throw error;
  }
}