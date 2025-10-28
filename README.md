# BFSI Insights

Agentic AI and other innovation related insights for executives and professionals in banking, financial services and insurance

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:
```
bfsi-insights/
├── astro.config.mjs
├── package.json
├── src/
│   ├── data/
│   │   ├── inbox/
│   │   │   └── urls.txt
│   │   └── resources/
│   │       └── items/
│   └── pages/
├── schemas/
│   └── kb.schema.json
├── scripts/
│   ├── add-url.mjs
│   └── ingest.mjs
└── node_modules/
```

Astro looks for `.astro` or `.md` files in the `src/pages/` directory. Each page is exposed as a route based on its file name.

There's nothing special about `src/components/`, but that's where we like to put any Astro/React/Vue/Svelte/Preact components.

Any static assets, like images, can be placed in the `public/` directory.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).

## Workflow Summary

1. See a link → paste into `src/data/inbox/urls.txt` (or run `npm run add:url -- <URL>`)
2. Run `npm run ingest`
3. The script creates `src/data/resources/items/YYYYMMDD_slug_hash.json`
4. Your build reads `src/data/resources.json` and renders the site

## Quick Start
```sh
npm run add:url -- https://example.com/some-report
npm run ingest
npm run build
```
