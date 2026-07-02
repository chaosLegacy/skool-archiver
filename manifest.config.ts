import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json";

export default defineManifest({
  manifest_version: 3,
  name: "Skool Archiver",
  description:
    "Archive Skool courses you have legitimately purchased for personal offline use.",
  version: pkg.version,
  icons: {
    16: "public/icons/icon16.png",
    48: "public/icons/icon48.png",
    128: "public/icons/icon128.png"
  },
  action: {
    default_popup: "src/popup/index.html",
    default_icon: {
      16: "public/icons/icon16.png",
      48: "public/icons/icon48.png",
      128: "public/icons/icon128.png"
    }
  },
  options_page: "src/options/index.html",
  background: {
    service_worker: "src/background/service-worker.ts",
    type: "module"
  },
  content_scripts: [
    {
      matches: ["https://www.skool.com/*", "https://skool.com/*"],
      js: ["src/content/content-script.ts"],
      run_at: "document_idle"
    }
  ],
  // "debugger" is required for genuinely trusted clicks on Skool's module
  // cards — they're react-beautiful-dnd draggables, which are notoriously
  // unreliable about firing their click handler for JS-dispatched synthetic
  // events (see background/trustedClick.ts). Attaching briefly shows Chrome's
  // "started debugging this browser" banner; that's expected.
  // "offscreen" lets the background create a hidden DOM page — service
  // workers don't have URL.createObjectURL, so saving a generated zip Blob
  // via chrome.downloads needs a real document to create that URL in (see
  // background/downloader.ts / offscreen/offscreen.ts).
  permissions: [
    "storage",
    "downloads",
    "unlimitedStorage",
    "activeTab",
    "scripting",
    "debugger",
    "offscreen"
  ],
  // Skool serves images/videos from asset subdomains (e.g. assets.skool.com),
  // distinct from the www.skool.com/skool.com pages the content script runs
  // on. Fetching those from the background needs their own host permission
  // or it hits normal cross-origin restrictions ("Failed to fetch").
  host_permissions: ["https://www.skool.com/*", "https://skool.com/*", "https://*.skool.com/*"],
  minimum_chrome_version: "114"
});
