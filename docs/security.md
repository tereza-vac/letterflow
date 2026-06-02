# Security & Privacy Model

letterflow is designed to be safe by default. This document describes how it
handles secrets, personal data, and sending.

## Principles

1. **Local-first.** Contacts, files, and the database never leave the device
   except for the two explicit network actions you trigger: AI generation and
   test sending.
2. **Data minimization to AI.** The AI provider receives only what is necessary.
3. **No silent destructive actions.** Nothing is deleted; invalid and
   review-needed rows are preserved in their own buckets.
4. **No hidden sending.** Every send is explicit, confirmed, and logged.
5. **No telemetry** in the MVP.

## Secrets

- AI API keys and SMTP passwords are stored in the **OS secure credential
  store** via the Rust `keyring` crate (`src-tauri/src/secure.rs`):
  Windows Credential Manager, macOS Keychain, or the Linux Secret Service.
- Secrets are **never**:
  - written to the SQLite database,
  - written to any plaintext file by letterflow,
  - logged,
  - re-displayed after saving (the UI shows a masked placeholder).
- In the **browser dev server** there is no OS keychain. Secrets are kept in
  memory for the session only and discarded on reload (see
  `src/lib/ai/secure-store.ts`). This keeps development safe — no plaintext at
  rest — at the cost of re-entering secrets.
- `.env` files are git-ignored. Only `.env.example` is committed, and it
  contains **no secrets** (letterflow does not read secrets from env vars).

## What is sent to the AI provider

The payload is assembled in `src/lib/ai/generate-email.ts` (`buildAiPayload`)
and is always shown to the user on the **Campaign brief** screen before
generating. It contains:

- the campaign brief you wrote,
- context text extracted from files you marked as "campaign context",
- **field names only** (e.g. `email`, `firstName`, `custom.dogName`) — never
  values,
- optionally, a few **anonymized sample rows** — only if you explicitly opt in,
  and even then values are masked (`maskValue`), e.g. `name@example.com`,
  `+000000000`, `xxxx`.

The full contact list is **never** sent.

## Network

- The app requires internet only for AI generation and test sending. An offline
  banner is shown and those actions are disabled when offline.
- Outbound AI requests are made from the Rust side via the Tauri HTTP plugin
  (`src/lib/ai/http.ts`), which bypasses webview CORS and lets you use any
  OpenAI-compatible provider (OpenAI, Gemini's OpenAI-compatible endpoint,
  Azure, a local server, …) without per-host webview allowlisting. The HTTP
  plugin scope is restricted to `https://*` in `capabilities/default.json`.
- The webview Content-Security-Policy (`tauri.conf.json` → `app.security.csp`)
  allows `connect-src https:` plus the Tauri IPC channel.

## Sending

- SMTP send happens in the Rust backend (`src-tauri/src/smtp.rs`) using
  `lettre` with rustls TLS. Browsers cannot open SMTP sockets, so sending is
  unavailable (and clearly reported) in the dev server.
- The MVP sends **one test email at a time**, after an explicit confirmation
  dialog that shows from/to/subject. Each attempt is logged with timestamp,
  recipient, status, and error.
- Bulk/production sending is **not implemented** in the MVP. Even behind the
  developer toggle, the architecture requires a completed test send and a low
  risk score before any future bulk send could proceed.

## Dependency note

The `xlsx` (SheetJS) package version on the npm registry has known advisories
(prototype pollution / ReDoS in older parsing paths). letterflow only parses
**local files the user chooses**, never untrusted remote input, which limits
exposure. Consider pinning to SheetJS's official CDN build if you need the
latest patched release.

## Reporting

Found a security issue? Please open a private report / security advisory on the
GitHub repository rather than a public issue.
