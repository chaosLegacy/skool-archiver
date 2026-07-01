# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install              # install dependencies
npm run dev               # vite build --watch (writes unpacked extension to dist/)
npm run build              # tsc -b --noEmit && vite build (production build to dist/)
npm run lint                # eslint .
npm test                     # vitest run
npm run test:watch            # vitest, watch mode
npx vitest run path/to.test.ts # run a single test file
```

Load `dist/` as an unpacked extension via `chrome://extensions` (Developer
mode → Load unpacked) to try it in Chrome.

## What this project is

A Manifest V3 Chrome extension that lets a user archive Skool courses they have legitimately purchased, for personal offline use. It must only operate on pages already accessible in the user's logged-in session — no bypassing auth, DRM, paywalls, or access controls. Full requirements are in `requirement.md`; key constraints to preserve when implementing:

- Never attempt to circumvent DRM or protected streaming. If a video can't be saved through normal browser capabilities, report that clearly instead of working around it.
- Only act on pages the user can already view.

## Architecture

- `src/content/` — content script: Skool detection, and low-level DOM message handlers (`GET_MODULE_ENTRIES`, `CLICK_MODULE_ENTRY`, `SCAN_VISIBLE_LESSONS_REQUEST`, `EXTRACT_LESSON_REQUEST`) that the background orchestrator drives.
- `src/background/` — MV3 service worker: `service-worker.ts` (message router, resume-on-startup), `moduleScanner.ts` (`scanSkoolCourse`: discovers modules by clicking Skool's href-less classroom cards and forcing the tab back to the root URL between each), and `pipeline.ts` (the `ArchivePipeline` class that drives tab navigation → extraction → resource download → packaging, with per-lesson retry/skip and persisted job state).
- `src/popup/` — React dashboard (scan, archive, live progress via `JOB_STATE_UPDATE` broadcasts, logs).
- `src/options/` — React settings UI (export formats, image/video toggles, parallelism, filename format, theme).
- `src/extractors/` — `types.ts` defines the `PlatformExtractor` contract; `blocks/` holds platform-agnostic per-content-type extractors (images, tables, videos, code blocks, attachments, quotes, links, body-walker); `skool/` is the Skool-specific implementation. Skool's classroom UI uses hashed styled-components class names that shift between deploys, so `skool/scanner.ts` and `skool/lessonExtractor.ts` key off durable signals instead: the `?md=` query param on every lesson link, and structural heuristics (leaf-text order, two-segment permalink paths) rather than class names. New LMS platforms are added by implementing `PlatformExtractor` and registering it in `extractors/index.ts`.
- `src/pdf/builder.ts` — reusable PDF layout engine on pdf-lib (page breaks, image scaling, code blocks, tables, clickable links, headers/footers).
- `src/exporters/` — `pdfExporter.ts`, `htmlExporter.ts`, `markdownExporter.ts`, `jsonExporter.ts`, and `zipPackager.ts` which assembles the full `Course Name/Modules/.../Lesson.{pdf,html,md,json}` + `images/` + `videos/` + `manifest.json` + `metadata.json` archive via JSZip.
- `src/download/` — `fetcher.ts` (credentialed fetch-as-blob with retry), `resourceDownloader.ts` (per-lesson image/video/attachment download with IndexedDB caching for resume), `downloader.ts` (Chrome Downloads API wrapper for saving the final zip).
- `src/storage/` — `settingsStore.ts` (chrome.storage.sync), `jobStore.ts` (chrome.storage.local job state), `db.ts` + `lessonCache.ts` (IndexedDB cache of extracted lessons and downloaded resource blobs, keyed by job — this is what makes interrupted jobs resumable without re-fetching).
- `src/utils/` — shared helpers (dom, id, sanitize, time, concurrency, logger, messaging).
- `src/types/index.ts` — shared types and the `ExtensionMessage` union used for all content↔background↔popup↔options messaging.

Full archive flow: Scan (background clicks through classroom module cards,
harvesting `?md=` lesson links per module) → for each lesson: navigate tab →
Extract → download resources → cache → repeat → package (zip) → save via
Chrome Downloads. Job state (`ArchiveJobState`, including the original
`CourseSummary`) is persisted after every lesson, so `chrome.runtime.onStartup`
can reconstruct and resume an interrupted `ArchivePipeline`, skipping lessons
already in the IndexedDB cache.

## Known limitations

See the "Known limitations" section of `README.md` — in short: Skool's
click-only module cards and structural DOM heuristics may need updates after
a Skool UI change, and only non-DRM/non-blob video sources are ever
downloaded.

## Tech stack

Manifest V3, TypeScript (strict), React (popup/options), Vite, Tailwind CSS, Chrome Storage API, Chrome Downloads API, pdf-lib, JSZip, IndexedDB.
