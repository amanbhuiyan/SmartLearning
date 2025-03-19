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
      <body style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
          <h2 style="color: #1a1a1a; margin: 0;">Daily Questions for ${firstName}</h2>
          <p style="color: #4B5563; margin: 8px 0 0 0;">${new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}</p>
        </div>
  `;

  Object.entries(questionsBySubject).forEach(([subject, questions]) => {
    log(`Processing ${questions.length} questions for subject: ${subject}`);
    emailHtml += `
      <div style="margin-top: 30px;">
        <h3 style="color: #2563eb; padding-bottom: 10px; border-bottom: 2px solid #e5e7eb;">
          ${subject.charAt(0).toUpperCase() + subject.slice(1)}
        </h3>
        ${formatQuestionsHtml(questions)}
      </div>
    `;
  });

  emailHtml += `
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <p style="color: #4B5563;">Keep learning and growing!</p>
          <p style="color: #4B5563; margin-bottom: 0;">Best regards,<br>The EduQuest Team</p>
        </div>
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <p style="color: #6B7280; font-size: 12px;">
            Sent via EduQuest Learning Platform
          </p>
        </div>
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
      from: 'Smart Learning <info@asn-global.co.uk>',  // Using verified domain
      to: [email],
      subject: 'Your Daily Learning Questions',
      html: emailHtml,
      text: 'This email contains your daily learning questions. Please view in an HTML-capable email client.',
    });

    if (error) {
      log(`Resend API Error: ${JSON.stringify(error)}`);
      if (error.statusCode === 403 && error.message?.includes('domain is not verified')) {
        log('Domain verification error - Please ensure asn-global.co.uk is verified in the Resend dashboard');
        throw new Error('Email domain is not yet verified. Please wait for domain verification to complete.');
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