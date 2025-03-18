import * as SibApiV3Sdk from '@sendinblue/client';
import type { Question } from "@shared/schema";
import { log } from "./vite";

if (!process.env.BREVO_API_KEY) {
  log("Warning: BREVO_API_KEY not set. Email functionality will be disabled.");
} else {
  log("BREVO_API_KEY is set and available");
}

let apiInstance: SibApiV3Sdk.TransactionalEmailsApi | null = null;

try {
  log("Initializing Brevo API client...");
  apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
  const apiKey = new SibApiV3Sdk.ApiKeyAuth('header', 'api-key');
  apiKey.apiKey = process.env.BREVO_API_KEY || '';
  apiInstance.setDefaultAuthentication(apiKey);
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
    sendSmtpEmail.subject = "Your Daily Learning Questions";
    sendSmtpEmail.htmlContent = emailHtml;
    sendSmtpEmail.sender = { name: "EduQuest Learning", email: "notifications@eduquest.com" };
    sendSmtpEmail.to = [{ email: email, name: firstName }];

    // Log the email configuration (without sensitive data)
    log(`Email configuration:
      - To: ${email}
      - Subject: ${sendSmtpEmail.subject}
      - Sender: ${sendSmtpEmail.sender.name} <${sendSmtpEmail.sender.email}>
      - Content length: ${emailHtml.length} characters`
    );

    log("Sending email via Brevo...");
    await apiInstance.sendTransacEmail(sendSmtpEmail);
    log(`Daily questions email sent successfully to ${email}`);
  } catch (error: any) {
    // Detailed error logging
    log(`Error sending email to ${email}:`);
    log(`Error message: ${error.message}`);
    if (error.response) {
      log(`API response status: ${error.response.status}`);
      log(`API response data: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}