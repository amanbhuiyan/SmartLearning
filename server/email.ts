import * as SibApiV3Sdk from '@sendinblue/client';
import type { Question } from "@shared/schema";
import { log } from "./vite";

if (!process.env.BREVO_API_KEY) {
  throw new Error("BREVO_API_KEY environment variable is required");
}

let apiInstance: SibApiV3Sdk.TransactionalEmailsApi | null = null;

try {
  log("Initializing Brevo API client...");
  const apiKey = process.env.BREVO_API_KEY;
  const defaultClient = SibApiV3Sdk.ApiClient.instance;
  defaultClient.authentications['api-key'].apiKey = apiKey;
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
  if (!apiInstance) {
    throw new Error("Email service not properly initialized");
  }

  log(`Preparing to send email to ${email}`);

  const formatQuestionsHtml = (questions: Question[]) => {
    return questions.map((q, index) => `
      <div style="margin-bottom: 20px; padding: 10px; border: 1px solid #eee; border-radius: 5px;">
        <p><strong>Question ${index + 1}:</strong> ${q.question}</p>
        <p><strong>Answer:</strong> ${q.answer}</p>
        ${q.explanation ? `<p><strong>Explanation:</strong> ${q.explanation}</p>` : ''}
      </div>
    `).join('\n');
  };

  let emailHtml = `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Hello ${firstName}!</h2>
        <p>Here are your daily learning questions:</p>
  `;

  Object.entries(questionsBySubject).forEach(([subject, questions]) => {
    log(`Processing ${questions.length} questions for subject: ${subject}`);
    emailHtml += `
      <h3 style="color: #2563eb; margin-top: 20px;">${subject.toUpperCase()}</h3>
      ${formatQuestionsHtml(questions)}
    `;
  });

  emailHtml += `
        <p style="margin-top: 20px;">Good luck with your learning journey!</p>
      </body>
    </html>
  `;

  try {
    log("Creating email payload...");

    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.to = [{ email: email, name: firstName }];
    sendSmtpEmail.sender = { 
      email: "noreply@eduquest.com",
      name: "EduQuest Learning"
    };
    sendSmtpEmail.subject = "Your Daily Learning Questions";
    sendSmtpEmail.htmlContent = emailHtml;

    log(`Email configuration prepared for ${email}`);
    log(`Subject: ${sendSmtpEmail.subject}`);
    log(`Content Length: ${emailHtml.length} bytes`);

    log("Sending email via Brevo API...");
    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
    log(`Email sent successfully! Response data: ${JSON.stringify(data)}`);

  } catch (error: any) {
    log(`Failed to send email to ${email}`);
    log(`Error message: ${error.message}`);

    if (error.response) {
      log(`API Status: ${error.response.status}`);
      log(`API Response: ${JSON.stringify(error.response.data)}`);
    }

    throw error;
  }
}