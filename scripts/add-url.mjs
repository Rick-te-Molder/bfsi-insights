import fs from "node:fs";
import path from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const INBOX = path.join(ROOT, "src/data/inbox/urls.txt");

const urlsFromArgs = process.argv.slice(2).filter(Boolean);
let urls = urlsFromArgs;

if (urls.length === 0) {
  // read from stdin (supports: pbpaste | npm run add:url --)
  const data = await new Promise(r => {
    let s = "";
    process.stdin.on("data", d => s += d.toString());
    process.stdin.on("end", () => r(s));
  });
  urls = data.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
}
if (urls.length === 0) process.exit(0);

fs.mkdirSync(path.dirname(INBOX), { recursive: true });
const existing = fs.existsSync(INBOX) ? fs.readFileSync(INBOX, "utf8") : "";
const seen = new Set(existing.split(/\r?\n/).map(s => s.trim()).filter(Boolean));
const toAppend = urls.filter(u => !seen.has(u)).join("\n");
if (toAppend) fs.appendFileSync(INBOX, (existing && !existing.endsWith("\n") ? "\n" : "") + toAppend + "\n");
console.log(`Queued ${urls.length} URL(s).`);