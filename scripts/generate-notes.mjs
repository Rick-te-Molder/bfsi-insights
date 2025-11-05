import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

const root = path.resolve(process.cwd());
const itemsDir = path.join(root, 'src', 'data', 'resources', 'items');
const args = process.argv.slice(2);
const overwriteAll = args.includes('--all');
const limitArg = args.find((a) => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity;
const TIMEOUT_MS = 15000;

function toSummary(text) {
  const clean = text.replace(/\s+/g, ' ').trim();
  const sentences = clean.split(/(?<=[.!?])\s+/).filter((s) => s && s.length > 1);
  let out = [];
  for (const s of sentences) {
    out.push(s);
    if (out.length >= 7) break;
    const joined = out.join(' ');
    if (out.length >= 5 && joined.length >= 500) break;
  }
  let summary = out.join(' ');
  if (summary.length > 900) summary = summary.slice(0, 900).replace(/\s+\S*$/, '') + '…';
  return summary;
}

function normalizeUrl(u) {
  if (!u) return u;
  // arXiv: prefer ABS page over PDF to read abstract
  const m = u.match(/https?:\/\/arxiv\.org\/pdf\/([^?#]+)\.pdf/i);
  if (m) return `https://arxiv.org/abs/${m[1]}`;
  return u;
}

async function fetchHTML(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: {
        'user-agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    if (!res.ok) throw new Error(`Fetch failed ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

function metaFallback(doc) {
  const m1 = doc.querySelector('meta[name="description"]')?.getAttribute('content');
  const m2 = doc.querySelector('meta[property="og:description"]')?.getAttribute('content');
  const m3 = doc.querySelector('meta[name="twitter:description"]')?.getAttribute('content');
  return [m1, m2, m3].find(Boolean) || '';
}

async function summarizeUrl(u) {
  const url = normalizeUrl(u);
  const html = await fetchHTML(url);
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();
  let content = article?.textContent || '';
  if (!content || content.trim().length < 120) {
    content = metaFallback(dom.window.document) || dom.window.document.body.textContent || '';
  }
  return toSummary(content);
}

async function main() {
  console.log('\nGenerating notes into per-item files...');
  const files = fs
    .readdirSync(itemsDir)
    .filter((f) => f.endsWith('.json'))
    .sort();
  let changed = 0;
  for (let i = 0, processed = 0; i < files.length && processed < limit; i++) {
    const file = files[i];
    const p = path.join(itemsDir, file);
    const raw = fs.readFileSync(p, 'utf8');
    const item = JSON.parse(raw);
    if (!overwriteAll && item.note && String(item.note).trim().length > 0) continue;
    process.stdout.write(`• [${processed + 1}] ${item.title?.slice(0, 60) || item.url} ... `);
    try {
      const note = await summarizeUrl(item.url);
      if (note && note.trim()) {
        item.note = note;
        fs.writeFileSync(p, JSON.stringify(item, null, 2));
        changed++;
        console.log('ok');
      } else {
        console.log('no content');
      }
    } catch (e) {
      console.log('fail');
    }
    processed++;
    await new Promise((r) => setTimeout(r, 250));
  }
  console.log(changed > 0 ? `Updated ${changed} item file(s).` : 'No changes.');
}

main();
