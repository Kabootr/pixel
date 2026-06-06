<div align="center">

# PixelMorph

**Browser-native image toolkit. Convert, resize, compress, crop, and tweak colours — all client-side.**

[![Live site](https://img.shields.io/badge/live-pixelmorph.app-171717?style=flat-square)](https://pixelmorph.app)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![Built with Astro](https://img.shields.io/badge/built_with-Astro-FF5D01?style=flat-square)](https://astro.build)
[![Deploys on Cloudflare](https://img.shields.io/badge/deploys_on-Cloudflare-F38020?style=flat-square)](https://workers.cloudflare.com)

*Your files never leave your browser. No uploads, no signup, no file-size limits.*

</div>

---

## What is PixelMorph?

PixelMorph is a free, open-source image toolkit that runs entirely inside your browser. Drop in PNG, JPG, WebP, GIF, SVG, ICO, or TIFF — convert formats, resize, compress, crop, or tweak colours — and never send a single byte to a server.

It is part of the [Kabootr](https://kabootr.studio) flock of local-first tools.

## Why?

Most "free online image tools" route your photos through a server farm, gate the good features behind a signup, and silently cap file sizes. PixelMorph does the opposite:

- **Private by design.** Every operation happens inside your browser via the Canvas API. There is no server endpoint that accepts your image data — open DevTools and watch the Network tab if you want to confirm.
- **No limits.** No file-size cap. No daily quota. No signup wall. Drop 5 MB photos or 200 MB design exports — it works the same.
- **Local-first library.** An IndexedDB-backed library keeps your working images across sessions. Back the whole library up as a single ZIP, restore it anywhere.

## Features

### Focused tools (great for SEO + quick tasks)

| Tool | URL | What it does |
| --- | --- | --- |
| **Convert** | `/` and `/png-to-jpg` etc. | Convert between PNG, JPG, WebP, GIF, SVG, ICO, TIFF — any pair, any direction. |
| **Resize** | `/resize` | By percentage, exact pixels, or "fit long side". Lock aspect, bulk apply, preset chips. |
| **Compress** | `/compress` | Quality slider with size deltas, smart auto-format picker, per-batch savings tally. |
| **Crop** | `/crop` | Interactive drag + 8 handles, 7 aspect-ratio presets (1:1, 4:3, 3:2, 16:9, 9:16, 2:3, 3:4), numeric X/Y/W/H. |
| **Adjust** | `/adjust` | Brightness, contrast, saturation, hue, sepia, grayscale, blur, invert. 6 style presets. Hold-to-compare. |

### Unified editor

| | |
| --- | --- |
| **Editor** | `/editor` |

A single canvas with all five tools as mode tabs, a local image library on the left, and a tool panel on the right. Save edited images back to the library, search by name, export the whole library as a ZIP, import it later.

The editor is for "do several things to one image" workflows; the focused pages are for bulk single-task work.

## Privacy guarantees

- All decoding, transformation, and encoding happens via the browser's Canvas API (`<canvas>`, `canvas.toBlob`, etc.) plus a couple of small JS libraries for less-common formats (UTIF for TIFF, fflate for ZIP).
- Saved images live in an IndexedDB database called `pixelmorph` in your browser. They never sync, never leave your machine.
- Backup creates a `.zip` on your device. You decide where it goes.
- No analytics on file contents. Page-level analytics (Google Analytics) only fire when configured with a real GA ID.

## Tech stack

- **[Astro 6](https://astro.build)** — static-first site framework. Multi-page (one route per tool) keeps each tool indexable on its own keywords.
- **[Tailwind v4](https://tailwindcss.com)** — via `@tailwindcss/vite`. Design tokens in `@theme {}`.
- **Vanilla TypeScript** in component `<script>` blocks. No client framework.
- **[idb](https://github.com/jakearchibald/idb)** — typed IndexedDB wrapper.
- **[fflate](https://github.com/101arrowz/fflate)** — fast zip/unzip for library backup.
- **[JSZip](https://stuk.github.io/jszip/)** — per-tool batch downloads.
- **[UTIF](https://github.com/photopea/UTIF.js)** — TIFF decode/encode.
- **Hand-rolled** GIF87a + ICO encoders in `src/lib/converter.js` (small, dependency-free).

Deployed to **[Cloudflare Workers](https://workers.cloudflare.com)** as a static asset bundle via `wrangler`.

## Project structure

```
src/
├── components/
│   ├── Converter.astro     — multi-file format converter (home page hero)
│   ├── Resizer.astro       — multi-file resize widget
│   ├── Compressor.astro    — multi-file compress widget
│   ├── Cropper.astro       — single-image interactive crop
│   ├── ColorAdjust.astro   — single-image color tweaker
│   ├── ToolsGrid.astro     — home page tool tiles
│   ├── FormatGrid.astro    — home page format tiles
│   ├── FeatureGrid.astro   — home page "why" tiles
│   ├── FAQ.astro           — collapsible FAQ section
│   ├── Hero.astro          — page hero with mesh gradient
│   ├── Nav.astro           — sticky nav with Tools dropdown
│   └── Footer.astro        — site footer
├── lib/
│   ├── converter.js        — decode/encode pipeline (raster, SVG, TIFF, ICO, GIF)
│   ├── image-ops.js        — shared resize / crop / adjust / encode primitives
│   ├── storage.js          — IndexedDB-backed image library
│   ├── backup.js           — ZIP backup/restore with manifest.json
│   ├── formats.js          — single source of truth for supported formats
│   └── faqData.js          — FAQ items + JSON-LD schema helper
├── pages/
│   ├── index.astro         — home page (converter hero + tool grid + FAQ)
│   ├── editor.astro        — unified editor + local library
│   ├── resize.astro        — /resize page
│   ├── compress.astro      — /compress page
│   ├── crop.astro          — /crop page
│   ├── adjust.astro        — /adjust page
│   ├── [converter].astro   — SEO doorway pages (42 from/to pairs)
│   ├── about.astro
│   ├── privacy.astro
│   └── 404.astro
├── layouts/
│   └── Layout.astro        — HTML shell, SEO meta, JSON-LD, theme bootstrap
└── styles/
    └── global.css          — design tokens, primitives, shared tool styles
```

## Getting started

### Prerequisites

- Node.js **≥ 22.12.0** (the version pinned in `package.json`)
- npm (or pnpm / yarn — your call)

### Install + dev

```sh
git clone https://github.com/Kabootr/pixel.git
cd pixel
npm install
npm run dev
```

The dev server runs at `http://localhost:4321`. Open it, drop in any image, and verify in DevTools' Network tab that nothing is uploaded.

### Scripts

| Command | Action |
| --- | --- |
| `npm run dev` | Start dev server with HMR. |
| `npm run build` | Build the static site to `dist/`. |
| `npm run preview` | Preview the production build locally. |
| `npm run deploy` | Build and deploy to Cloudflare Workers (`wrangler deploy`). |
| `npm run astro -- --help` | Astro CLI help. |

### Deploying somewhere else

The output is plain static files in `dist/`. Drop it on Vercel, Netlify, GitHub Pages, S3 + CloudFront — anywhere that serves static assets. No serverless functions required.

## Adding a new format

1. Append a record to `FORMATS` in [`src/lib/formats.js`](src/lib/formats.js) with `id`, `label`, `mime`, `ext`, `pros`, `cons`, etc.
2. Implement decode / encode for it in [`src/lib/converter.js`](src/lib/converter.js) (and [`src/lib/image-ops.js`](src/lib/image-ops.js) if it should work in the editor pipeline).
3. The doorway page generator in [`src/pages/[converter].astro`](src/pages/[converter].astro) and the sitemap pick the new format up automatically.

## Adding a new tool

1. Create the component in `src/components/YourTool.astro`. Reuse the `.tool-shell`, `.drop-zone`, `.file-list`, and `.action-bar` classes from `global.css` so it inherits the design system.
2. Create the page in `src/pages/your-tool.astro` — copy one of the existing tool pages (e.g. `resize.astro`) as a template; it has the JSON-LD scaffolding, FAQs, breadcrumbs, etc.
3. Wire it in:
   - [`src/components/ToolsGrid.astro`](src/components/ToolsGrid.astro) — add a tile.
   - [`src/components/Nav.astro`](src/components/Nav.astro) — add a dropdown entry + mobile nav entry.
   - [`src/components/Footer.astro`](src/components/Footer.astro) — add a Tools column link.

## Roadmap

- HEIC / AVIF / BMP / EPS format support
- Multi-frame animated GIF + animated WebP encoder
- Background remover (WASM, optional download)
- Watermark / batch text overlay
- More editor presets + LUT support

Have a request? Open an [issue](https://github.com/Kabootr/pixel/issues).

## Contributing

PRs are welcome — especially:

- Performance work in the encode/decode hot paths
- New format support (with tests against the existing pipeline)
- Accessibility audits — the tool UIs have lots of interactive bits

Process:

1. Fork the repo and create a feature branch.
2. `npm install && npm run dev` — confirm the change works.
3. `npm run build` — make sure the static build still succeeds.
4. Open a PR with a clear description of the user-visible change.

Please don't introduce dependencies that ship server-side code or phone home. The "everything runs in the browser" promise is the entire point of the project.

## Sister project

PixelMorph shares its local-first ethos and library architecture with **[PDF Tools](https://github.com/Kabootr/pdf-tools)** — the same IndexedDB-via-`idb` + ZIP-with-manifest backup pattern, applied to PDFs instead of images.

## License

[MIT](LICENSE) © Kabootr
