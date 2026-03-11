// Email service abstraction.
// Supports: Resend (recommended), Nodemailer (SMTP fallback), or console logging (dev).
//
// Set EMAIL_PROVIDER=resend and RESEND_API_KEY for production.
// Set EMAIL_PROVIDER=smtp and SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS for SMTP.
// Otherwise emails are logged to console.

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(opts: SendEmailOptions): Promise<boolean> {
  const provider = process.env.EMAIL_PROVIDER || "console";

  try {
    if (provider === "resend") {
      return await sendWithResend(opts);
    } else if (provider === "smtp") {
      return await sendWithSMTP(opts);
    } else {
      console.log(`[EMAIL] To: ${opts.to} | Subject: ${opts.subject}`);
      console.log(`[EMAIL] Body: ${opts.text || opts.html.substring(0, 200)}`);
      return true;
    }
  } catch (err) {
    console.error("[EMAIL] Failed to send:", err);
    return false;
  }
}

async function sendWithResend(opts: SendEmailOptions): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY not set");

  const fromEmail = process.env.EMAIL_FROM || "RoomFlow <noreply@roomflow.app>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    }),
  });

  return res.ok;
}

async function sendWithSMTP(opts: SendEmailOptions): Promise<boolean> {
  const nodemailer = await import("nodemailer");

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || "RoomFlow <noreply@roomflow.app>",
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });

  return true;
}

// --- Email templates ---

export function clientInviteEmail(
  designerName: string,
  projectTitle: string,
  portalUrl: string,
  tempPassword?: string
): SendEmailOptions {
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">You've been invited to review a project</h2>
      <p>${designerName} has invited you to review <strong>${projectTitle}</strong> on RoomFlow.</p>
      <p>View the project and leave your feedback:</p>
      <a href="${portalUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 16px 0;">
        View Project
      </a>
      ${tempPassword ? `<p style="margin-top: 24px; padding: 12px; background: #f3f4f6; border-radius: 8px;"><strong>Your temporary password:</strong> ${tempPassword}<br><small>Please change this after your first login.</small></p>` : ""}
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #9ca3af; font-size: 12px;">Sent via RoomFlow · Interior Design Client Portal</p>
    </div>
  `;

  return {
    to: "", // caller sets this
    subject: `${designerName} invited you to review "${projectTitle}"`,
    html,
    text: `${designerName} has invited you to review "${projectTitle}". View: ${portalUrl}`,
  };
}

export function commentNotificationEmail(
  commenterName: string,
  objectName: string,
  comment: string,
  portalUrl: string
): SendEmailOptions {
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">New comment on "${objectName}"</h2>
      <p><strong>${commenterName}</strong> left a comment:</p>
      <blockquote style="border-left: 3px solid #2563eb; padding-left: 12px; margin: 16px 0; color: #374151;">${comment}</blockquote>
      <a href="${portalUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none;">
        View in RoomFlow
      </a>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #9ca3af; font-size: 12px;">Sent via RoomFlow</p>
    </div>
  `;

  return {
    to: "",
    subject: `New comment on "${objectName}" from ${commenterName}`,
    html,
    text: `${commenterName} commented on "${objectName}": "${comment}"`,
  };
}

export function approvalNotificationEmail(
  clientName: string,
  objectName: string,
  status: string,
  note: string | null,
  projectUrl: string
): SendEmailOptions {
  const statusLabel =
    status === "APPROVED" ? "approved ✓" : status === "REJECTED" ? "rejected ✕" : "requested changes ↻";

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">${clientName} ${statusLabel} "${objectName}"</h2>
      ${note ? `<p>Note: <em>${note}</em></p>` : ""}
      <a href="${projectUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 16px 0;">
        View Project
      </a>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #9ca3af; font-size: 12px;">Sent via RoomFlow</p>
    </div>
  `;

  return {
    to: "",
    subject: `${clientName} ${statusLabel} "${objectName}"`,
    html,
    text: `${clientName} ${statusLabel} "${objectName}"${note ? ` — Note: ${note}` : ""}`,
  };
}
