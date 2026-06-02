# User Guide

A step-by-step walkthrough of letterflow, from a fresh install to an exported
campaign. The app is a 10-step wizard; the left-hand stepper lets you move back
and forth at any time.

> **Run the desktop app.** Web fetch, SMTP and reliable AI generation only work
> in the packaged app (or `npm run tauri dev`), not in the browser dev preview.

---

## 1. Settings

Configure two things before you start a campaign.

### AI provider

letterflow works with any OpenAI-compatible chat API.

- **OpenAI** — Base URL `https://api.openai.com/v1`, Model `gpt-4o-mini`.
- **Google Gemini** — Base URL
  `https://generativelanguage.googleapis.com/v1beta/openai`, Model
  `gemini-2.5-flash` (fast) or `gemini-2.5-pro`.

Paste your API key, click **Save key**, then **Test AI connection**. The key is
stored in your operating system's credential manager — never on disk or in logs.

### SMTP (test sending)

Enter your mail server's host, port, username, sender email/name and encryption
(STARTTLS for port 587, SSL/TLS for 465). Click **Save password**, then **Send
connection test**.

> For Gmail you'll need an **app password** (not your normal password), with
> 2-step verification enabled.

---

## 2. Upload files

Drag in or browse for files:

- `.xlsx`, `.csv` → detected as **contact sources**
- `.md`, `.txt` → detected as **campaign context** (notes the AI can read)

You can override the detected type for any file. Contact files go through column
mapping; context files are combined into the brief later.

---

## 3. Map contacts

For each column letterflow suggests a target field (email, first name, last
name, full name, or a custom field) with a confidence score and a short
explanation. English and Czech headers are recognized, plus custom fields like
`dogName` or `city`.

- An **email column is required**.
- Anything unmapped becomes a custom field you can use as `{{ custom.<key> }}`.

---

## 4. Clean contacts

letterflow normalizes and validates emails, removes exact duplicates, carefully
merges custom fields, and flags near-duplicate names for **review** (never
auto-deleting). Results are split into tabs:

- **Valid** — ready to use
- **Needs review** — likely duplicates or suspicious values
- **Invalid** — bad/missing emails

A **data-quality report** summarizes missing values, invalid/duplicate rates,
and other signals.

---

## 5. Campaign brief

Describe the email in your own words — rough and incomplete is fine.

### Source links (read facts from the web)

Paste one or more links to pages that contain the real details (event date,
location, prices…). letterflow will:

1. Fetch each page in the desktop app.
2. Extract **structured data** (`schema.org` JSON-LD) and page metadata
   (title, description, Open Graph), plus the main readable text.
3. Pass these as **verified facts** to the AI.

URLs written directly in the brief text are picked up automatically too.

> Why this matters: many sites are JavaScript apps whose visible text is empty
> in the raw HTML. Reading structured data and metadata is what lets the AI use
> the **correct** date and venue instead of guessing.

The right-hand panel shows exactly **what gets sent to the AI** (brief, context,
fetched page content, field names). Real contact values are never sent unless
you explicitly opt in to masked samples.

---

## 6. Generate

Click **Generate**. The AI returns:

- 3 **subject options** (one recommended)
- a **plain-text** body and an **HTML** body
- a **footer** with unsubscribe wording
- **Missing information** warnings (facts it couldn't find — shown as
  `[ADD ...]` placeholders)
- tone notes and personalization suggestions

A **Read from your links** box shows the verified facts that were sent to the
AI. If the date or location look wrong there, fix the source link and
regenerate. The recommended draft is applied automatically, so you can move
straight to editing; use **Use & edit** on a different subject to switch.

---

## 7. Edit email

Fine-tune everything manually (subject, preview text, plain-text and HTML
bodies, from name/email). The sidebar lets you insert **template variables** at
your cursor.

### Edit with AI

- **Regenerate email** — type short instructions (e.g. "shorten the intro",
  "change the date to June 5", "warmer tone") and the AI rewrites the whole
  draft, keeping facts and variables intact.
- **Rewrite selection** — select a passage in any body field, then rewrite only
  that part. The rest is left untouched.

Missing-information warnings from the AI are shown here too, so you know what to
fill in.

### Template variables

| Variable | Resolves to |
| -------- | ----------- |
| `{{ firstName }}`, `{{ lastName }}`, `{{ fullName }}`, `{{ email }}` | Contact fields |
| `{{ custom.<key> }}` | A mapped custom field (e.g. `custom.dogName`) |
| `{{ unsubscribe_url }}` | System variable, filled at send/export time |
| `{{ firstName \| default: "there" }}` | Field with a fallback when empty |

---

## 8. Preview

See the email rendered for several **diverse real contacts** (not just the first
row) — chosen to surface missing values and edge cases. Unresolved variables are
highlighted in red, and fallbacks in amber, so problems are obvious before you
send.

---

## 9. Test send

A **campaign safety score** (0–100, Low/Medium/High) lists issues with concrete
fixes. **Critical** issues block sending until resolved — for example a missing
subject, sender, body, unsubscribe wording, or unresolved variables. Warnings
(e.g. "no test send yet") raise the score but don't block.

Enter a recipient you control and click **Send test email**. A confirmation
dialog shows from/to/subject; every attempt is recorded in the **send log**.

---

## 10. Export

Download a complete package for use elsewhere:

- cleaned contacts, plus invalid and needs-review lists (CSV/XLSX)
- the plain-text and HTML bodies
- an import report
- a full JSON campaign archive

Take these to a professional sending platform (Ecomail, Mailchimp, MailerLite,
Brevo, Amazon SES, …) for real, deliverable, unsubscribe-compliant sending.

---

## Bulk send (advanced, opt-in)

> letterflow is **not** a deliverability platform. Bulk sending from a personal
> SMTP account works for small volumes but can be rate-limited or blocked, and
> has no real unsubscribe handling. For production campaigns, export and use a
> dedicated platform.

Bulk send is **off by default**. Turn it on in **Settings → Developer options →
Enable experimental bulk send**; a **Bulk send** entry then appears in the
sidebar (and a shortcut on the Test send step).

The screen is guarded:

1. **Recipients** — computed from your cleaned contacts. It shows how many will
   receive the email and a breakdown of who is skipped (suppressed,
   unsubscribed/invalid, malformed email, or already sent in a previous run).
2. **Suppression list** — paste addresses (comma, space or newline separated)
   that must never be contacted, e.g. opt-outs. They are skipped on every run
   and persist between sessions.
3. **Safety score** — the same checks as Test send. Bulk send is blocked until
   there are no critical issues **and** a test send has succeeded.
4. **Dry run** (on by default) — renders every message and reports what *would*
   be sent, without sending anything. Always dry-run first.
5. **Delay between emails** — throttles delivery (≈1000 ms is a good default).
6. Click **Dry run** / **Send**, confirm (you must type `SEND` for a real send),
   and watch live progress. Use **Stop** to abort mid-run.

Every run is recorded in a per-recipient log. Successful real sends are
remembered, so re-running won't email the same person twice.

---

## Troubleshooting

| Problem | Likely cause / fix |
| ------- | ------------------ |
| `Failed to fetch` / AI call fails | You're in the browser preview (CORS), or the model timed out. Use the desktop app; try `gemini-2.5-flash`. |
| 404 from the AI | Wrong Base URL or model name. For Gemini use `…/v1beta/openai` and a valid `gemini-*` model. |
| Wrong date/venue in the email | The source page may be JS-rendered with no structured data. Check the **Read from your links** box; add the facts to the brief or a `.txt`/`.md` note. |
| Empty fields on **Edit email** | Generate first; the recommended draft is applied automatically after generation. |
| Test send blocked | Resolve the **critical** items in the safety score (sender, SMTP, unsubscribe, unresolved variables). |
| Bulk send button disabled | Needs the developer toggle on, a successful test send, no critical issues, and at least one eligible recipient. A real send also needs the desktop app and an internet connection (dry run works anywhere). |
| SMTP/AI says secrets missing after reload | In the browser preview, secrets are memory-only and cleared on reload. Use the desktop app for persistent secure storage. |
