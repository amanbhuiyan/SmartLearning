import { Resend } from 'resend';
import type { Question } from "@shared/schema";
import { log } from "./vite";

if (!process.env.RESEND_API_KEY) {
  throw new Error("RESEND_API_KEY environment variable is required");
}

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendDailyQuestions(
  email: string, 
  firstName: string,
  questionsBySubject: Record<string, Question[]>
) {
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
        <p style="color: #2563eb; font-weight: bold;">This is a test email from EduQuest Learning Platform.</p>
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
        <hr>
        <p style="color: #666; font-size: 12px;">This is a test email sent on ${new Date().toLocaleString()}. 
        If you received this email, it means our email system is working correctly.</p>
      </body>
    </html>
  `;

  try {
    log("Creating email payload...");

    // Log email configuration (without sensitive data)
    log(`Email configuration prepared:`);
    log(`To: ${email}`);
    log(`Content Length: ${emailHtml.length} bytes`);

    log("Sending email via Resend API...");
    const { data, error } = await resend.emails.send({
      from: 'onboarding@resend.dev',  // Using Resend's verified domain
      to: [email],
      subject: 'Your Daily Learning Questions',
      html: emailHtml,
      text: 'This email contains your daily learning questions. Please view in an HTML-capable email client.',
    });

    if (error) {
      log(`Resend API Error: ${JSON.stringify(error)}`);
      throw error;
    }

    log(`Email sent successfully! Message ID: ${data?.id}`);

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