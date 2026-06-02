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
- **M6 — Packaging & docs** ✅ Windows `.exe` packaging verified (standalone
  `letterflow.exe`, NSIS setup, and MSI installer produced via `tauri build`),
  documentation, security review.

## Next

- **Builds**: signed Windows installer; macOS `.dmg`; Linux `.deb`/AppImage.
- **More AI providers**: Azure OpenAI, local models, Anthropic (via abstraction
  in `src/lib/ai/providers/`).
- **More email providers**: Resend, SendGrid, Mailgun, Brevo, Amazon SES (via
  abstraction in `src/lib/email/`).
- **Normalized SQLite storage**: migrate the key/value snapshot to the full
  relational schema (Drizzle) defined in `src/lib/storage/sql-schema.ts`.
- **Templates library**: save/reuse templates.

## Guarded bulk sending

A first, opt-in version ships behind **Settings → Developer options** (off by
default). It already includes:

- ✅ dry-run mode by default and manual confirmation (type `SEND`),
- ✅ delay between emails (throttle),
- ✅ skip unsubscribed / invalid / suppressed / already-sent contacts,
- ✅ block sending when there are critical issues / no successful test send,
- ✅ require a completed test send first,
- ✅ per-recipient send log persisted across runs,
- ✅ stop mid-run.

Still to do:

- batch size, delay between batches, and a daily limit,
- pause/resume (currently stop-only),
- a hard configurable recipient cap.

## Unsubscribe / suppression

- ✅ Local suppression list with paste/import; bulk send never contacts
  suppressed, unsubscribed or invalid contacts.
- Still to do: mark-as-unsubscribed actions from the contacts table, and
  importing a suppression file directly.
- Do not fake one-click unsubscribe; recommend a professional platform or a
  provider with proper unsubscribe handling for production campaigns.
