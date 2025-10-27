import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import fs from 'node:fs';
import path from 'node:path';

function emitHeadersFile() {
  return { name:'emit-headers-file', apply:'build', closeBundle() {
    const out = path.resolve('dist/_headers');
    const content = `/*
  Cache-Control: public, max-age=300, must-revalidate

/assets/*
  Cache-Control: public, max-age=31536000, immutable
`;
    fs.writeFileSync(out, content);
  }};
}

export default defineConfig({
  site: 'https://www.bfsiinsights.com',
  integrations: [tailwind()],
  vite: { plugins: [emitHeadersFile()] },
});