# Screenshots

Put PNG screenshots here and reference them from the main `README.md`.

These are **the only thing the documentation can't generate itself** — please
capture them from the running desktop app (the dark theme looks best). Use a
window width around 1200px so the layout matches the default.

## Recommended shots

| File name | What to capture | Why | Status |
| --------- | --------------- | --- | ------ |
| `settings.png` | Settings with AI provider + SMTP | Setup story | ✅ captured |
| `brief.png` | Campaign brief with the "What gets sent to AI" panel | Privacy + web-fetch story | ✅ captured |
| `edit.png` | Edit email with the "Edit with AI" panel visible | Manual + AI editing | ✅ captured |
| `welcome.png` | The Welcome screen | First impression / hero image | ⬜ optional |
| `generate.png` | Generate step with subject options and verified facts | The core AI feature | ⬜ optional |
| `preview.png` | Preview step rendering a real contact | Personalization | ⬜ optional |
| `test-send.png` | Test send with the safety score | Safety story | ⬜ optional |
| `bulk-send.png` | Bulk send with dry-run, recipients and suppression | Guarded bulk story | ✅ captured |

The README currently uses `edit.png` as the hero and embeds `settings.png` and
`brief.png` in the relevant sections. Add more from the optional list as you
capture them.

## How to capture

1. Run the desktop app: `npm run tauri dev`.
2. Load sample data quickly with the **Load test data (dev)** button on the
   Welcome screen (only visible in dev builds).
3. Use Windows **Snipping Tool** (`Win` + `Shift` + `S`) to grab each screen.
4. Save the PNGs into this folder with the names above.

## Wire them into the README

Reference any new shot with a normal Markdown image, for example:

```markdown
![letterflow bulk send](docs/screenshots/bulk-send.png)
```
