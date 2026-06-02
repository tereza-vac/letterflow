# letterflow

**Local, AI-assisted email campaign builder.** Turn messy files, spreadsheets and
notes into clean email drafts, validated contact lists, personalized previews,
and safe test sends — all on your own computer.

letterflow is a small, safety-first desktop alternative to tools like Ecomail,
Mailchimp, MailerLite or Brevo. It does **not** try to be a full newsletter
platform. Instead it focuses on the messy, error-prone preparation work:
importing and cleaning contacts, drafting a good email from a rough brief,
previewing personalization, sending **one** safe test, and exporting everything
so you can send through a professional platform when you're ready.

> Built with Tauri + React + TypeScript. Your data stays local by default.

---

## What it does

- 📂 **Import** `.xlsx`, `.csv`, `.md`, `.txt` files and auto-detect which are
  contact sources vs. campaign context.
- 🧭 **Map columns** to contact fields with confidence scores and plain-language
  explanations (recognizes English **and** Czech column names, plus custom
  fields like dog names).
- 🧹 **Clean contacts**: normalize and validate emails, deduplicate by email,
  carefully merge custom fields, and flag near-duplicate names for review —
  *without ever silently deleting data*.
- 📊 **Data quality report**: missing values, invalid email rate, duplicate
  rate, suspicious rows, long values, diacritics/special characters.
- ✍️ **AI drafting** from a rough brief: 3 subject options, plain-text + HTML
  bodies, a footer with unsubscribe wording, and missing-information warnings.
  Structured JSON output, rendered part-by-part.
- 🔠 **Template variables** (`{{ firstName }}`, `{{ custom.dogName }}`, with
  `| default: "there"` fallbacks) and missing-variable analysis.
- 👀 **Smart preview** across diverse real contacts (not just the first row),
  with unresolved variables and fallbacks highlighted.
- 🛡️ **Campaign safety score** with blocking checks (missing subject/sender/
  unsubscribe, unresolved variables, no SMTP, …).
- 📨 **One guarded test send** through your own SMTP, with a confirmation
  dialog and a full send log.
- 📤 **Export** cleaned/invalid/review contacts (CSV/XLSX), plain-text + HTML
  bodies, an import report, and a full JSON campaign archive.

## What it does **not** do yet

- ❌ No bulk / production sending in the MVP (the architecture is designed for
  it, but it's intentionally disabled and heavily guarded).
- ❌ No real one-click unsubscribe page / hosting. The draft includes
  unsubscribe wording and an `{{ unsubscribe_url }}` placeholder; real
  unsubscribe handling belongs to a dedicated sending platform.
- ❌ No suppression-list management, scheduling, A/B testing, analytics, or
  telemetry.

---

## Supported file types

| Type   | Treated as       | Parser            |
| ------ | ---------------- | ----------------- |
| `.xlsx`| contact source   | SheetJS (`xlsx`)  |
| `.csv` | contact source   | PapaParse         |
| `.md`  | campaign context | `marked`          |
| `.txt` | campaign context | plain text        |

You can override the detected type for any file.

---

## Installation

### Prerequisites

- **Node.js** 18+ and **npm**
- **Rust** (stable) — required to build/run the desktop app. Install via
  [rustup.rs](https://rustup.rs).
- Platform build tools for Tauri — see the
  [Tauri prerequisites guide](https://v2.tauri.app/start/prerequisites/)
  (on Windows: *Microsoft C++ Build Tools* and *WebView2*, which ships with
  Windows 11).

### Clone & install

```bash
git clone https://github.com/tereza-vac/letterflow.git
cd letterflow
npm install
```

---

## Local development

You can develop the UI in two ways:

```bash
# 1) Browser dev server (fast UI iteration). SMTP sending and the OS keychain
#    are unavailable here; secrets live in memory for the session only.
npm run dev

# 2) Full desktop app (requires Rust). SMTP + OS secure storage enabled.
npm run tauri dev
```

Other useful scripts:

```bash
npm run typecheck   # tsc --noEmit
npm run test        # vitest (unit tests for the core logic)
npm run build       # typecheck + Vite production build of the frontend
```

---

## Building a Windows `.exe`

> Requires Rust + the Windows build tools (see Prerequisites).

1. Generate app icons (one-time, from the included source SVG or your own PNG):

   ```bash
   npm run tauri icon src-tauri/icons/letterflow.svg
   ```

2. Build the installers:

   ```bash
   npm run tauri build
   ```

The bundled installers are written to
`src-tauri/target/release/bundle/` (NSIS `.exe` and MSI on Windows). macOS
(`.dmg`) and Linux (`.deb`/AppImage) targets are configured for later.

This build is verified on Windows (Rust 1.96, MSVC toolchain) and produces:

- `src-tauri/target/release/letterflow.exe` (standalone)
- `src-tauri/target/release/bundle/nsis/letterflow_0.1.0_x64-setup.exe`
- `src-tauri/target/release/bundle/msi/letterflow_0.1.0_x64_en-US.msi`

---

## Setting up the AI API key

1. Open **Settings** in the app.
2. Choose your OpenAI-compatible **Base URL** and **Model**
   (default `https://api.openai.com/v1` and `gpt-4o-mini`).
3. Paste your **API key** and click **Save key**. The key is stored in the OS
   credential manager and is never written to disk in plain text or logged.
4. Click **Test AI connection** to verify.

Any service exposing the OpenAI `/chat/completions` contract can be used by
changing the base URL/model.

## Setting up SMTP test sending

1. In **Settings → SMTP**, enter host, port, username, sender email, sender
   name, and encryption mode (STARTTLS / SSL-TLS / none).
2. Click **Save password** (stored securely, never displayed again).
3. Click **Send connection test**.

SMTP sending only works in the packaged desktop app (the browser dev server
cannot open SMTP sockets).

---

## Privacy

- All contact data, files, and the local database stay on your device.
- **By default, no personal data is sent to the AI provider.** Only your brief,
  context text, and anonymized **field names** are sent.
- Sample rows are sent **only** if you explicitly opt in, and even then values
  are **masked** (e.g. `xxxx@example.com`).
- Secrets are stored in the OS secure credential store (Windows Credential
  Manager / macOS Keychain / Linux Secret Service), never in the database.
- No telemetry.

See [`docs/security.md`](docs/security.md) for the full security model.

## Safety limitations

- letterflow prepares and tests campaigns; it is **not** a deliverability
  solution. Real bulk sending requires SPF/DKIM/DMARC, proper unsubscribe
  handling, and reputation management.
- The `{{ unsubscribe_url }}` placeholder is **not** a working unsubscribe link.
- Bulk sending is disabled in the MVP and remains guarded even behind the
  developer toggle (requires a completed test send and a low risk score).

> ⚠️ For real campaigns, export your cleaned contacts and content and send
> through a dedicated email platform with proper deliverability and unsubscribe
> handling (Ecomail, Mailchimp, MailerLite, Brevo, Amazon SES, …).

---

## Project structure

```
letterflow/
├─ src/
│  ├─ app/            # App shell, global state (zustand), styles
│  ├─ components/     # UI primitives (shadcn-style) + layout
│  ├─ features/       # One folder per step screen
│  └─ lib/            # Pure, tested business logic
│     ├─ ai/          # provider abstraction, OpenAI, prompt, secure store
│     ├─ contacts/    # normalize, validate, dedupe, fuzzy, quality-report
│     ├─ imports/     # parse-csv/xlsx/markdown, detect-columns
│     ├─ templates/   # render + validate template variables
│     ├─ safety/      # campaign-risk scoring
│     ├─ preview/     # smart preview sampling
│     ├─ email/       # provider abstraction + SMTP bridge
│     ├─ export/      # CSV/XLSX/JSON exporters
│     └─ storage/     # SQLite schema + persistence adapter
├─ src-tauri/         # Rust backend (SMTP via lettre, OS keyring), config
└─ docs/              # product spec, security, roadmap
```

## Roadmap

See [`docs/roadmap.md`](docs/roadmap.md). Highlights: macOS/Linux builds, more
AI/email providers (Resend, SendGrid, Mailgun, Brevo, SES), local suppression
lists, and a carefully guarded bulk-send mode.

## License

[MIT](LICENSE)
