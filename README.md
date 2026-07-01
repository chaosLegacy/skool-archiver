# Skool Archiver

A Manifest V3 Chrome extension for archiving Skool courses you have
**legitimately purchased** for personal, offline use. It only ever reads pages
already visible in your logged-in browser session — it never bypasses
authentication, paywalls, or DRM. Videos served through a protected/DRM stream
are reported as "not downloadable" instead of being worked around.

## Requirements

- Node.js 18+
- Google Chrome (or any Chromium-based browser) 114+

## Install dependencies

```bash
npm install
```

## Development

```bash
npm run dev
```

This runs Vite in watch mode and writes an unpacked extension to `dist/`.
Load it in Chrome:

1. Go to `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** and select the `dist/` folder
4. After each change, Vite rebuilds `dist/` automatically — click the reload
   icon on the extension card in `chrome://extensions` to pick it up (full
   HMR isn't available for MV3 background/content scripts)

## Production build

```bash
npm run build
```

Outputs a ready-to-load unpacked extension to `dist/`. Zip that folder if you
need to distribute it manually (e.g. for the Chrome Web Store).

## Lint / type-check / tests

```bash
npm run lint
npx tsc -b --noEmit
npm test
```

## Using the extension

1. Log into skool.com and open a classroom you've purchased.
2. Click the extension icon. If the page is recognized as a Skool classroom,
   click **Scan Classroom** to build the module/lesson tree.
3. Click **Archive Classroom** to start the full pipeline: extract every
   lesson → download images (and videos where the browser can access them
   directly) → generate PDF/HTML/Markdown/JSON → zip everything into
   `Course Name.zip`, saved via Chrome's downloads.
4. Progress, logs, and any failed/skipped lessons are shown live in the popup.
   If the browser closes mid-archive, reopening the classroom and clicking
   Archive again resumes from the last completed lesson — nothing already
   downloaded is re-fetched.
5. Adjust export formats, image/video download toggles, parallelism, filename
   format, and theme from the extension's **Settings** (options) page.

## Architecture

```
src/
  content/      content scripts (Skool detection, scan/extract message handling)
  background/   MV3 service worker: archive pipeline orchestrator, tab navigation, messaging
  popup/        React dashboard (scan, archive, live progress, logs)
  options/      React settings UI
  extractors/   DOM extraction, one module per content type + per-platform registry
  pdf/          reusable PDF layout engine (pdf-lib): page breaks, images, tables, code, links
  exporters/    PDF/HTML/Markdown/JSON exporters + zip packaging
  download/     resource fetching, Chrome Downloads API wrapper, retry/resume
  storage/      chrome.storage (settings, job state) + IndexedDB (lesson/resource cache)
  utils/        shared helpers (DOM, ids, sanitizing, concurrency, time, logging)
  types/        shared TypeScript types and message contracts
```

New LMS platforms can be supported by adding a module under `extractors/`
that implements `PlatformExtractor` and registering it in
`extractors/index.ts` — nothing else in the pipeline needs to change.

## Known limitations

- Skool's classroom UI is a client-rendered app with class names that can
  change between deploys. Selectors live in `extractors/skool/selectors.ts`
  with layered fallbacks; if scanning/extraction stops matching content after
  a Skool UI update, that's the first file to check.
- Only videos the browser can already fetch as a normal file (a direct
  `<video src>` that isn't a blob/MediaSource stream) are downloaded. Embedded
  YouTube/Vimeo/Loom/Wistia players and DRM/adaptive-streamed HTML5 video are
  reported as protected rather than downloaded.
- Very large courses with many/large videos may be memory-intensive to zip in
  a single pass inside the service worker; the images/attachments path is
  fine for typical course sizes.
