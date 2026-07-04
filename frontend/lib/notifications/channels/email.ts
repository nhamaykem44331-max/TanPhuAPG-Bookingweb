import nodemailer from "nodemailer";

export interface EmailMessage {
  to: string;
  cc?: string;
  subject: string;
  html: string;
  text: string;
}

function emailEnabled(): boolean {
  return process.env.NOTIFICATIONS_EMAIL_ENABLED === "true";
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  if (!emailEnabled() || !process.env.SMTP_HOST) {
    console.info("email skipped", { to: message.to, subject: message.subject });
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          }
        : undefined,
  });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || "noreply@tanphuapg.com",
    replyTo: process.env.EMAIL_REPLY_TO || "support@tanphuapg.com",
    to: message.to,
    cc: message.cc,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });

  console.info("email sent", { to: message.to, subject: message.subject });
}
