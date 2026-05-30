import { isTauri } from "@/lib/runtime";

/**
 * Secure storage for secrets (AI API keys, SMTP passwords).
 *
 * Security model:
 *  - Secrets are NEVER written to the SQLite database or any plaintext file by
 *    letterflow itself.
 *  - In the Tauri desktop build, secrets go to the OS credential manager
 *    (Windows Credential Manager / macOS Keychain / libsecret) via the Rust
 *    `keyring` crate, exposed through the `secure_get`/`secure_set`/`secure_delete`
 *    commands (see src-tauri/src/secure.rs).
 *  - In the browser dev server (no OS keychain available), secrets are kept in
 *    memory for the current session only and discarded on reload. This keeps
 *    development safe (no plaintext at rest) at the cost of re-entry.
 */
export interface SecureStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

class MemorySecureStore implements SecureStore {
  private map = new Map<string, string>();
  async get(key: string) {
    return this.map.get(key) ?? null;
  }
  async set(key: string, value: string) {
    this.map.set(key, value);
  }
  async delete(key: string) {
    this.map.delete(key);
  }
}

class TauriKeyringStore implements SecureStore {
  private async invoke<T>(cmd: string, args: Record<string, unknown>): Promise<T> {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<T>(cmd, args);
  }
  async get(key: string): Promise<string | null> {
    try {
      const v = await this.invoke<string | null>("secure_get", { key });
      return v ?? null;
    } catch {
      return null;
    }
  }
  async set(key: string, value: string): Promise<void> {
    await this.invoke<void>("secure_set", { key, value });
  }
  async delete(key: string): Promise<void> {
    try {
      await this.invoke<void>("secure_delete", { key });
    } catch {
      // Already absent — ignore.
    }
  }
}

let store: SecureStore | null = null;
export function getSecureStore(): SecureStore {
  if (store) return store;
  store = isTauri() ? new TauriKeyringStore() : new MemorySecureStore();
  return store;
}

export const SECRET_KEYS = {
  aiApiKey: "letterflow.ai.apiKey",
  smtpPassword: "letterflow.smtp.password",
} as const;
