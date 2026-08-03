import nodemailer from "nodemailer";
import { getSecurityBaseUrl, isEmailTransportConfigured } from "@/lib/security/config";

function buildAbsoluteUrl(path: string) {
  return new URL(path, getSecurityBaseUrl()).toString();
}

async function sendTransactionalEmail(input: {
  to: string;
  subject: string;
  text: string;
}) {
  if (!isEmailTransportConfigured()) {
    if (process.env.NODE_ENV !== "production") {
      console.info(
        `[security-email:${input.subject}] ${input.to}\n${input.text}`
      );
    }

    return {
      delivered: false,
      channel: "console",
    } as const;
  }

  const transporter = nodemailer.createTransport(process.env.EMAIL_SERVER!);
  await transporter.sendMail({
    from: process.env.EMAIL_FROM!,
    to: input.to,
    subject: input.subject,
    text: input.text,
  });

  return {
    delivered: true,
    channel: "smtp",
  } as const;
}

export async function sendEmailVerificationEmail(input: {
  to: string;
  rawToken: string;
}) {
  const verificationUrl = buildAbsoluteUrl(
    `/verify-email?token=${encodeURIComponent(input.rawToken)}`
  );

  return sendTransactionalEmail({
    to: input.to,
    subject: "[SWUFE HotelSim] Verify your email",
    text: [
      "Please verify your SWUFE HotelSim account email.",
      "",
      `Verification link: ${verificationUrl}`,
      "",
      "If you did not request this, you can ignore this email.",
    ].join("\n"),
  });
}

export async function sendPasswordResetEmail(input: {
  to: string;
  rawToken: string;
}) {
  const resetUrl = buildAbsoluteUrl(
    `/reset-password?token=${encodeURIComponent(input.rawToken)}`
  );

  return sendTransactionalEmail({
    to: input.to,
    subject: "[SWUFE HotelSim] Reset your password",
    text: [
      "A password reset was requested for your SWUFE HotelSim account.",
      "",
      `Reset link: ${resetUrl}`,
      "",
      "If you did not request this, you can ignore this email.",
    ].join("\n"),
  });
}
