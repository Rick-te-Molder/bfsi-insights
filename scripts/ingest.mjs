import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fetch } from "undici";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

/* ---------- paths ---------- */
const ROOT = new URL("..", import.meta.url).pathname;
const INBOX = path.join(ROOT, "src/data/inbox/urls.txt");
const ITEMS_DIR = path.join(ROOT, "src/data/resources/items");
const SCHEMA_PATH = path.join(ROOT, "schemas/kb.schema.json");

/* ---------- load schema ---------- */
if (!fs.existsSync(SCHEMA_PATH)) {
  console.error("Schema not found:", SCHEMA_PATH);
  process.exit(1);
}
const SCHEMA = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));

/* ---------- ajv (draft 2020-12) ---------- */
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(SCHEMA);

/* ---------- helpers ---------- */
const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);

const deriveTime = (dateStr) => {
  const d = new Date(dateStr);
  if (isNaN(d)) return "all";
  const days = (Date.now() - d.getTime()) / 86400000;
  if (days <= 7) return "last-7-days";
  if (days <= 30) return "last-30-days";
  if (days <= 365) return "last-12-months";
  return "all";
};

const normalizeUrl = (u) => {
  let s = (u || "").trim();
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  // encode spaces and other unsafe chars
  s = encodeURI(s);
  return s;
};

/* ---------- metadata extractor ---------- */
async function extract(url) {
  try {
    const res = await fetch(url, { redirect: "follow" });
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("text/html")) {
      // likely PDF or binary; fall back to hostname
      const source = new URL(url).hostname.replace(/^www\./, "");
      return { title: "", date: "", source };
    }
    const html = await res.text();
    const pick = (re) => (html.match(re)?.[1] || "").trim();

    const title =
      pick(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i) ||
      pick(/<title[^>]*>([^<]+)<\/title>/i);

    const published =
      pick(/<meta\s+property=["']article:published_time["']\s+content=["']([^"']+)["']/i) ||
      pick(/<meta\s+name=["']date["']\s+content=["']([^"']+)["']/i) ||
      pick(/datetime=["'](\d{4}-\d{2}-\d{2})/i);

    const date = published ? new Date(published).toISOString().slice(0, 10) : "";
    const source = new URL(url).hostname.replace(/^www\./, "");
    return { title, date, source };
  } catch {
    return { title: "", date: "", source: "" };
  }
}

/* ---------- main ---------- */
async function main() {
  if (!fs.existsSync(INBOX)) {
    console.log("No inbox file found.");
    return;
  }

  // Read and normalize inbox URLs
  const lines = fs
    .readFileSync(INBOX, "utf8")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(normalizeUrl);

  if (lines.length === 0) {
    console.log("Inbox empty.");
    return;
  }

  fs.mkdirSync(ITEMS_DIR, { recursive: true });

  // Existing URLs to skip duplicates
  const existing = new Set();
  for (const f of fs.readdirSync(ITEMS_DIR).filter((f) => f.endsWith(".json"))) {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(ITEMS_DIR, f), "utf8"));
      if (j.url) existing.add(normalizeUrl(j.url));
    } catch {}
  }

  const toProcess = lines.filter((u) => !existing.has(u));
  let created = 0;

  for (const url of toProcess) {
    const meta = await extract(url);
    const cls = {
      // safe defaults; replace with LLM later
      role: "professional",
      industry: "cross-bfsi",
      topic: "technology-and-data-ai",
      use_cases: "audit-support",
      agentic_capabilities: "monitoring",
      content_type: "article",
      jurisdiction: "global",
    };

    const item = {
      // NOTE: no `$schema` here; your schema has additionalProperties:false
      url,
      title: meta.title || url,
      source: meta.source || "",
      date: meta.date || "",
      time: deriveTime(meta.date || ""),
      ...cls,
    };

    if (!validate(item)) {
      console.error("Validation failed for", url + ":", validate.errors);
      process.exit(1);
    }

    const ymd = (item.date || new Date().toISOString().slice(0, 10)).replace(/-/g, "");
    const base = slugify(item.title || new URL(url).hostname) || "untitled";
    const hash = crypto.createHash("md5").update(url).digest("hex").slice(0, 6);
    const filename = `${ymd}_${base}_${hash}.json`;

    await fsp.writeFile(
      path.join(ITEMS_DIR, filename),
      JSON.stringify(item, null, 2) + "\n"
    );
    created++;
  }

  // Clear inbox
  await fsp.writeFile(INBOX, "");
  console.log(`Created ${created} new item file(s).`);
}

main();