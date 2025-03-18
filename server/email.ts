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
        <p style="color: #2563eb; font-weight: bold;">Welcome to your daily EduQuest learning questions!</p>
        <p>Here are your personalized questions for today:</p>
  `;

  Object.entries(questionsBySubject).forEach(([subject, questions]) => {
    log(`Processing ${questions.length} questions for subject: ${subject}`);
    emailHtml += `
      <h3 style="color: #2563eb; margin-top: 20px;">${subject.toUpperCase()}</h3>
      ${formatQuestionsHtml(questions)}
    `;
  });

  emailHtml += `
        <p style="margin-top: 20px;">Keep learning and growing!</p>
        <p style="margin-top: 10px; color: #4B5563;">Best regards,<br>The EduQuest Team</p>
        <hr>
        <p style="color: #666; font-size: 12px;">Sent via EduQuest Learning Platform on ${new Date().toLocaleString()}</p>
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
      from: 'EduQuest <noreply@asn-global.co.uk>',  // Using your domain
      to: [email],
      subject: 'Your Daily Learning Questions',
      html: emailHtml,
      text: 'This email contains your daily learning questions. Please view in an HTML-capable email client.',
    });

    if (error) {
      log(`Resend API Error: ${JSON.stringify(error)}`);
      // If domain verification error, fall back to resend.dev domain
      if (error.statusCode === 403 && error.message?.includes('domain is not verified')) {
        log('Falling back to resend.dev domain...');
        const fallbackResponse = await resend.emails.send({
          from: 'onboarding@resend.dev',
          to: [email],
          subject: 'Your Daily Learning Questions',
          html: emailHtml,
          text: 'This email contains your daily learning questions. Please view in an HTML-capable email client.',
        });

        if (fallbackResponse.error) {
          throw fallbackResponse.error;
        }

        log(`Email sent successfully with fallback domain! Message ID: ${fallbackResponse.data?.id}`);
        return;
      }
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