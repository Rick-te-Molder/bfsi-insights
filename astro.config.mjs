export default defineConfig({
  site: 'https://www.bfsiinsights.com',
  vite: { plugins: [emitHeadersFile()] },
});