import { isTauri } from "@/lib/runtime";
import type {
  EmailProvider,
  OutgoingEmail,
  SendResult,
  SmtpConfig,
} from "@/lib/email/types";

/**
 * SMTP provider. The actual network send happens in the Tauri Rust backend
 * (using the `lettre` crate) via the `smtp_test` and `smtp_send` commands —
 * browsers cannot open raw SMTP sockets. When running outside Tauri (the dev
 * server), sending is unavailable and returns a clear, safe error rather than
 * pretending to send.
 */
async function invokeTauri<T>(cmd: string, args: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

const NOT_AVAILABLE: SendResult = {
  ok: false,
  error:
    "Sending requires the desktop app. SMTP is not available in the browser dev preview.",
};

export const smtpProvider: EmailProvider = {
  id: "smtp",
  label: "SMTP",

  async testConnection(config: SmtpConfig, password: string): Promise<SendResult> {
    if (!isTauri()) return NOT_AVAILABLE;
    try {
      await invokeTauri<void>("smtp_test", { config: toRustConfig(config, password) });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  async sendOne(
    config: SmtpConfig,
    password: string,
    email: OutgoingEmail,
  ): Promise<SendResult> {
    if (!isTauri()) return NOT_AVAILABLE;
    try {
      await invokeTauri<void>("smtp_send", {
        config: toRustConfig(config, password),
        email,
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },
};

/** Shape the Rust command expects (snake_case-friendly, includes password). */
function toRustConfig(config: SmtpConfig, password: string) {
  return {
    host: config.host,
    port: config.port,
    username: config.username,
    password,
    senderEmail: config.senderEmail,
    senderName: config.senderName,
    encryption: config.encryption,
  };
}

const PROVIDERS: Record<string, EmailProvider> = {
  [smtpProvider.id]: smtpProvider,
};

export function getEmailProvider(id: string): EmailProvider {
  const p = PROVIDERS[id];
  if (!p) throw new Error(`Unknown email provider: ${id}`);
  return p;
}
