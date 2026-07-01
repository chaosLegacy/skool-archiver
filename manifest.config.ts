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
  permissions: ["storage", "downloads", "unlimitedStorage", "activeTab", "scripting"],
  host_permissions: ["https://www.skool.com/*", "https://skool.com/*"],
  minimum_chrome_version: "114"
});
