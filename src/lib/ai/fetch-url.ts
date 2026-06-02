import { Readability } from "@mozilla/readability";
import { providerFetch } from "@/lib/ai/http";

/** Result of fetching and extracting the readable content of a single URL. */
export interface FetchedPage {
  url: string;
  title: string;
  text: string;
  /** Human-readable bullet list of authoritative facts (dates, venue, …). */
  verifiedFacts: string;
  ok: boolean;
  error?: string;
}

/** Upper bound on extracted text per page, to keep the AI payload reasonable. */
const MAX_CHARS_PER_PAGE = 8000;

/**
 * Fetch a web page and extract its main readable content.
 *
 * The request goes through {@link providerFetch} so in the desktop app it is
 * performed natively (no CORS). Structured data (JSON-LD Event) and head metadata
 * are read first — critical for JavaScript-rendered SPAs where the body is empty.
 */
export async function fetchPageText(
  url: string,
  signal?: AbortSignal,
): Promise<FetchedPage> {
  try {
    const res = await providerFetch(url, {
      method: "GET",
      headers: { Accept: "text/html,application/xhtml+xml,*/*" },
      signal,
    });
    if (!res.ok) {
      return emptyPage(url, `HTTP ${res.status}`);
    }
    const html = await res.text();
    const { title, text, verifiedFacts } = extractContent(html);
    if (!text) {
      return {
        url,
        title,
        text: "",
        verifiedFacts,
        ok: false,
        error: "No readable text found (the page may be JavaScript-rendered)",
      };
    }
    return {
      url,
      title,
      text: text.slice(0, MAX_CHARS_PER_PAGE),
      verifiedFacts,
      ok: true,
    };
  } catch (err) {
    return emptyPage(url, err instanceof Error ? err.message : String(err));
  }
}

function emptyPage(url: string, error: string): FetchedPage {
  return { url, title: "", text: "", verifiedFacts: "", ok: false, error };
}

/** Fetch several URLs, preserving input order. */
export async function fetchPages(
  urls: string[],
  signal?: AbortSignal,
): Promise<FetchedPage[]> {
  const valid = urls.map((u) => u.trim()).filter(Boolean);
  return Promise.all(valid.map((u) => fetchPageText(normalizeUrl(u), signal)));
}

/** Turn fetched pages into a context block that can be appended to the brief. */
export function pagesToContext(pages: FetchedPage[]): string {
  return pages
    .filter((p) => p.ok && (p.text || p.verifiedFacts))
    .map((p) => {
      const header = p.title ? `${p.title} (${p.url})` : p.url;
      const parts: string[] = [`# Web page: ${header}`];
      if (p.verifiedFacts) {
        parts.push(
          "## Verified facts (authoritative — use these exact values for dates, times, venue and event name; do NOT guess or use other years/locations):",
          p.verifiedFacts,
        );
      }
      if (p.text) parts.push("## Page content", p.text);
      return parts.join("\n\n");
    })
    .join("\n\n")
    .trim();
}

/** Add a protocol if the user pasted a bare host like "example.com/page". */
export function normalizeUrl(url: string): string {
  const trimmed = url.trim().replace(/[.,;]+$/, "");
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/** Pull http(s) URLs out of free text (e.g. the campaign brief). */
export function extractUrlsFromText(text: string): string[] {
  const re = /https?:\/\/[^\s<>"')\]]+/gi;
  const found = text.match(re) ?? [];
  return [...new Set(found.map((u) => normalizeUrl(u)))];
}

/** Merge explicit source links with URLs found in the brief. */
export function collectSourceUrls(sourceUrls: string[], brief: string): string[] {
  return [
    ...new Set([
      ...sourceUrls.map((u) => normalizeUrl(u.trim())).filter(Boolean),
      ...extractUrlsFromText(brief),
    ]),
  ];
}

function extractContent(html: string): {
  title: string;
  text: string;
  verifiedFacts: string;
} {
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(html, "text/html");
  } catch {
    return { title: "", text: "", verifiedFacts: "" };
  }

  const jsonLdFacts = extractJsonLdFacts(doc);
  const meta = extractMeta(doc);

  let title = "";
  let body = "";
  try {
    const clone = doc.cloneNode(true) as Document;
    const article = new Readability(clone).parse();
    if (article?.textContent && article.textContent.trim()) {
      title = (article.title ?? "").trim();
      body = normalizeWhitespace(article.textContent);
    }
  } catch {
    // Fall through.
  }
  if (!body) body = stripBody(doc);
  if (!title) title = doc.querySelector("title")?.textContent?.trim() ?? "";

  const text = [meta, body].filter(Boolean).join("\n\n").trim();
  return { title, text, verifiedFacts: jsonLdFacts };
}

function extractMeta(doc: Document): string {
  const attr = (selector: string) =>
    doc.querySelector(selector)?.getAttribute("content")?.trim() ?? "";
  const title =
    doc.querySelector("title")?.textContent?.trim() ||
    attr('meta[property="og:title"]');
  const description =
    attr('meta[name="description"]') || attr('meta[property="og:description"]');
  const keywords = attr('meta[name="keywords"]');

  const lines: string[] = [];
  if (title) lines.push(`Title: ${title}`);
  if (description) lines.push(`Description: ${description}`);
  if (keywords) lines.push(`Keywords: ${keywords}`);
  return lines.join("\n");
}

/** Parse schema.org Event blocks from JSON-LD script tags. */
function extractJsonLdFacts(doc: Document): string {
  const events: Record<string, unknown>[] = [];
  doc.querySelectorAll('script[type="application/ld+json"]').forEach((el) => {
    try {
      const raw = el.textContent?.trim();
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      collectJsonLdObjects(parsed, events);
    } catch {
      // Malformed JSON-LD — skip.
    }
  });
  const lines = events.flatMap((e) => formatEventFacts(e));
  return [...new Set(lines)].join("\n");
}

function collectJsonLdObjects(node: unknown, out: Record<string, unknown>[]): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    node.forEach((item) => collectJsonLdObjects(item, out));
    return;
  }
  const obj = node as Record<string, unknown>;
  const type = obj["@type"];
  const types = Array.isArray(type) ? type : type ? [type] : [];
  if (types.some((t) => String(t).toLowerCase() === "event")) {
    out.push(obj);
  }
  if (obj["@graph"]) collectJsonLdObjects(obj["@graph"], out);
}

/** Format a schema.org Event object into prompt-friendly fact lines. Exported for tests. */
export function formatEventFacts(event: Record<string, unknown>): string[] {
  const lines: string[] = [];
  if (event.name) lines.push(`Event name: ${String(event.name)}`);
  if (event.startDate) lines.push(`Start: ${formatIsoDateTime(String(event.startDate))}`);
  if (event.endDate) lines.push(`End: ${formatIsoDateTime(String(event.endDate))}`);
  if (event.url) lines.push(`Event URL: ${String(event.url)}`);

  const loc = event.location;
  if (loc && typeof loc === "object") {
    const place = loc as Record<string, unknown>;
    if (place.name) lines.push(`Venue: ${String(place.name)}`);
    const addr = place.address;
    if (addr && typeof addr === "object") {
      const a = addr as Record<string, unknown>;
      const parts = [
        a.streetAddress,
        a.addressLocality,
        a.addressRegion,
        a.postalCode,
      ]
        .filter(Boolean)
        .map(String);
      if (parts.length) lines.push(`Address: ${parts.join(", ")}`);
    }
  }

  if (event.description) {
    const desc = String(event.description).trim();
    if (desc.length <= 200) lines.push(`About: ${desc}`);
  }
  return lines;
}

function formatIsoDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const date = d.toLocaleDateString("cs-CZ", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const time = d.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" });
  return `${date}, ${time}`;
}

function stripBody(doc: Document): string {
  try {
    doc
      .querySelectorAll("script,style,noscript,template,svg")
      .forEach((el) => el.remove());
    return normalizeWhitespace(doc.body?.textContent ?? "");
  } catch {
    return "";
  }
}

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
