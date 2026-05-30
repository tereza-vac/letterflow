# Roadmap

## Status: MVP

The MVP can import messy files, extract and clean contacts, generate a good
email draft from a rough brief, allow editing, preview personalization across
diverse contacts, send one safe test email, and export everything.

### Milestones

- **M1 — Shell & setup** ✅ Tauri + React scaffold, UI shell, Settings, internet
  check, file upload UI.
- **M2 — Import** ✅ CSV/XLSX parsing, column detection, mapping, email
  validation, dedupe, import report.
- **M3 — Drafting** ✅ Campaign brief, AI generation, email editor, template
  variables.
- **M4 — Preview & safety** ✅ Preview, missing-variable analysis, smart preview
  sampling, risk score.
- **M5 — Send & export** ✅ SMTP test send, test-send logs, export package.
- **M6 — Packaging & docs** 🟡 Windows `.exe` packaging, documentation, security
  review. *(Requires Rust toolchain to produce binaries.)*

## Next

- **Builds**: signed Windows installer; macOS `.dmg`; Linux `.deb`/AppImage.
- **More AI providers**: Azure OpenAI, local models, Anthropic (via abstraction
  in `src/lib/ai/providers/`).
- **More email providers**: Resend, SendGrid, Mailgun, Brevo, Amazon SES (via
  abstraction in `src/lib/email/`).
- **Normalized SQLite storage**: migrate the key/value snapshot to the full
  relational schema (Drizzle) defined in `src/lib/storage/sql-schema.ts`.
- **Templates library**: save/reuse templates.

## Future: guarded bulk sending

Not in the MVP. When added, it must include:

- dry-run mode by default and manual confirmation,
- recipient limit, batch size, delay between emails and batches, daily limit,
- pause/resume, send logs,
- skip unsubscribed / invalid / already-sent contacts,
- block sending when the risk score is high,
- require a completed test send first.

## Future: unsubscribe handling

- Local unsubscribe/suppression list and suppression-list import.
- Never send to contacts marked unsubscribed.
- Do not fake one-click unsubscribe; recommend a professional platform or a
  provider with proper unsubscribe handling for production campaigns.
