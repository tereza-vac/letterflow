import { z } from "zod";

export const SmtpEncryption = z.enum(["ssl_tls", "starttls", "none"]);
export type SmtpEncryption = z.infer<typeof SmtpEncryption>;

/** Non-secret SMTP settings. The password is stored in the secure store. */
export const SmtpConfig = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  username: z.string(),
  senderEmail: z.string().email(),
  senderName: z.string(),
  encryption: SmtpEncryption,
});
export type SmtpConfig = z.infer<typeof SmtpConfig>;

export interface OutgoingEmail {
  to: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  text: string;
  html: string;
}

export interface SendResult {
  ok: boolean;
  error?: string;
}

/**
 * Provider abstraction so SMTP can be joined later by Resend, SendGrid,
 * Mailgun, Brevo, Amazon SES, etc. Each provider only needs to implement a
 * connection test and a single-message send for the MVP.
 */
export interface EmailProvider {
  id: string;
  label: string;
  testConnection(config: SmtpConfig, password: string): Promise<SendResult>;
  sendOne(
    config: SmtpConfig,
    password: string,
    email: OutgoingEmail,
  ): Promise<SendResult>;
}

export const DEFAULT_SMTP_CONFIG: SmtpConfig = {
  host: "",
  port: 587,
  username: "",
  senderEmail: "",
  senderName: "",
  encryption: "starttls",
};
