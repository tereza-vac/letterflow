# Changelog

All notable changes to letterflow are documented here. This project follows
[Semantic Versioning](https://semver.org/).

## [0.1.0] — 2026-06-02

First public MVP: a local, safety-first desktop app (Windows) for preparing
email campaigns from messy files and a rough brief.

### Added

- **Import & clean** — parse `.xlsx`, `.csv`, `.md`, `.txt`; auto-detect contact
  sources vs. campaign context; column mapping with confidence scores
  (English + Czech headers, custom fields); email normalization/validation,
  deduplication, near-duplicate review, and a data-quality report.
- **Read facts from the web** — fetch source links (or URLs found in the brief),
  extract `schema.org` JSON-LD events, head metadata and readable text, and pass
  **verified facts** (date, venue, …) to the AI.
- **AI drafting** — generate 3 subject options, plain-text + HTML bodies, a
  footer with unsubscribe wording, and missing-information warnings. Structured
  JSON output validated with Zod.
- **Edit with AI** — regenerate the whole draft from short instructions, or
  rewrite only a selected passage; manual edits are preserved.
- **Template variables** — `{{ firstName }}`, `{{ custom.* }}`,
  `{{ unsubscribe_url }}`, with `| default: "…"` fallbacks and missing-variable
  analysis.
- **Smart preview** across diverse real contacts, highlighting unresolved
  variables and fallbacks.
- **Campaign safety score** (0–100) with blocking checks and concrete fixes.
- **Guarded test send** through your own SMTP, with a confirmation dialog and a
  send log.
- **Guarded bulk send** (opt-in, off by default behind **Settings → Developer
  options**): dry-run-first, with a typed `SEND` confirmation, a configurable
  per-email delay, live progress, a stop control, and a per-recipient log that
  persists across runs. Requires a successful test send and a clear safety
  score, and automatically skips suppressed, unsubscribed, invalid and
  already-sent contacts.
- **Suppression list** — paste/add emails that must never be contacted; bulk
  send always skips them.
- **Export** cleaned/invalid/review contacts (CSV/XLSX), email bodies, an import
  report, and a full JSON campaign archive.
- **OpenAI-compatible AI providers** — works with OpenAI and Google Gemini's
  OpenAI-compatible endpoint (configurable Base URL and model).
- **Secure secret storage** in the OS credential manager; data minimization to
  the AI provider (no personal data by default); no telemetry.
- **Windows packaging** via Tauri (`tauri build`): standalone `.exe`, NSIS
  installer, and MSI; documentation (README, user guide, architecture, security,
  roadmap).

### Notes & limitations

- Full functionality (web fetch, SMTP, reliable AI calls) requires the desktop
  app; the browser dev preview is for UI iteration only.
- AI requests use a native HTTP path with a 120s timeout in the desktop app. For
  Gemini, JSON-mode (`response_format`) is omitted for compatibility; the JSON
  shape is enforced via the prompt.
- Bulk sending is opt-in and intentionally limited (small volumes, your own
  SMTP); it is not a deliverability solution and stays off by default.
- No scheduling, A/B testing, analytics, or real one-click unsubscribe hosting
  in this release.

[0.1.0]: https://github.com/tereza-vac/letterflow/releases/tag/v0.1.0
