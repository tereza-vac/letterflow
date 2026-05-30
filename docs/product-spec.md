# Product Spec

## Positioning

A local desktop app that turns messy files and a rough brief into a clean,
previewable, test-sendable email campaign — then exports everything for use in a
professional sending platform. A small, safe alternative to Ecomail, Mailchimp,
MailerLite, and Brevo for the *preparation* phase.

## Target user

Non-technical people with messy spreadsheets, notes, or event information who
want a professional email without manually cleaning data or adopting a large
SaaS newsletter tool.

## Constraints

- Runs locally as a desktop app (Tauri); packageable as a Windows `.exe`.
- macOS/Linux builds planned later.
- No public domain/hosting/server needed for the MVP.
- Internet required for AI generation and test sending; clear offline warning.
- Contact data stays local by default.
- Full recipient lists are never sent to AI.
- Test sending supported; bulk sending disabled/guarded.

## App flow

`Welcome → Settings → Upload → Map → Clean → Brief → Generate → Edit → Preview → Test send → Export`

The same order is used by the left-hand stepper in the UI.

## Screens (implemented)

1. **Welcome / connection check** — product intro, online/offline status, and a
   clear warning that AI + sending need internet.
2. **Settings** — OpenAI-compatible AI config + secure API key; SMTP config +
   secure password; connection tests; developer bulk toggle (off by default).
3. **Upload** — multi-file upload with type detection (contacts/context/unknown)
   and manual override; context snippets.
4. **Map contacts** — per-column detection with confidence + explanations,
   manual mapping, custom-field keys. Requires an email column.
5. **Clean contacts** — normalize/validate/dedupe, import summary, valid /
   needs-review / invalid tabs, and a data-quality panel.
6. **Brief** — large free-text brief + example; shows exactly what will be sent
   to AI; opt-in anonymized samples.
7. **Generate** — structured AI output: subjects, plain/HTML, footer, missing
   info, tone notes, personalization suggestions.
8. **Edit** — edit subject/preview/plain/HTML, variable sidebar, missing
   variable analysis, add unsubscribe line.
9. **Preview** — smart sampling across diverse contacts; HTML + plain;
   highlights unresolved variables and fallbacks.
10. **Test send** — safety score with blocking checks; single confirmed test
    send; send log.
11. **Export** — contacts (CSV/XLSX), invalid/review, plain/HTML, import report,
    JSON archive.

## Data model

See `src/lib/types.ts` and the SQLite DDL in `src/lib/storage/sql-schema.ts`.
Entities: `Contact`, `ContactList`, `Campaign`, `Template`, `UploadedFile`,
`ImportJob`, `ImportIssue`, `TestSendLog`, `SettingsMetadata`.

## Detection & quality logic

- Email validation: conservative pattern (`src/lib/contacts/validate.ts`).
- Normalization: trim, lowercase, strip invisible chars (emails);
  diacritics-insensitive **matching only** (never for stored values).
- Dedupe: exact normalized email; careful custom-field merge (multi-values kept
  as a list); near-duplicate names flagged for review, never auto-merged.
- Fuzzy: Levenshtein + Jaro-Winkler (`src/lib/contacts/fuzzy.ts`).
- Quality: per-field missing/long/diacritics/special-char metrics, invalid &
  duplicate rates, suspicious rows.

## Safety score

`src/lib/safety/campaign-risk.ts` produces a Low/Medium/High level, a 0–100
score, reasons with fixes, and blockers. Critical blockers (missing subject,
sender email, SMTP config, body, unsubscribe wording, unresolved variables)
prevent sending.

## Non-goals (MVP)

Bulk sending, scheduling, analytics, A/B testing, real unsubscribe hosting,
suppression lists, telemetry.
