import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import tailwind from '@astrojs/tailwind';
import fs from 'node:fs';
import path from 'node:path';

function emitHeadersFile() {
  return {
    name: 'emit-headers-file',
    apply: 'build',
    closeBundle() {
      const out = path.resolve('dist/_headers');
      const content = `/*
  Cache-Control: public, max-age=300, must-revalidate

/publications
  Cache-Control: public, max-age=0, must-revalidate

/assets/*
  Cache-Control: public, max-age=31536000, immutable
`;
      fs.writeFileSync(out, content);
    },
  };
}

export default defineConfig({
  site: 'https://www.bfsiinsights.com',
  srcDir: './apps/web',
  publicDir: './apps/web/public',
  output: 'static',
  adapter: cloudflare(),
  integrations: [tailwind()],
  vite: {
    plugins: [emitHeadersFile()],
  },
});
