import { idbDelete, idbSet, STORES } from "@/storage/db";
import type { ExtensionMessage } from "@/types";

export interface DownloadResult {
  downloadId: number;
  filename: string;
}

const OFFSCREEN_URL = "src/offscreen/index.html";

/** Service workers don't implement URL.createObjectURL — only real DOM
 *  documents do — so creating and reusing a hidden "offscreen document" is
 *  Chrome's sanctioned way to get one from the background. Cached across
 *  calls in this module-level promise so repeated downloads (e.g. "all",
 *  then later "just this classroom") don't recreate it each time. */
let offscreenReady: Promise<void> | null = null;

async function ensureOffscreenDocument(): Promise<void> {
  if (offscreenReady) return offscreenReady;
  offscreenReady = chrome.offscreen
    .createDocument({
      url: OFFSCREEN_URL,
      reasons: [chrome.offscreen.Reason.BLOBS],
      justification: "Create a blob: URL so a generated archive zip can be saved via chrome.downloads."
    })
    .catch((error: unknown) => {
      // "Only a single offscreen document may be created" — one already
      // exists from an earlier call and is still open; nothing to do.
      const message = error instanceof Error ? error.message : String(error);
      if (!/single offscreen/i.test(message)) {
        offscreenReady = null;
        throw error;
      }
    });
  return offscreenReady;
}

async function requestObjectUrl(downloadKey: string, mimeType: string): Promise<string> {
  const response = (await chrome.runtime.sendMessage({
    type: "CREATE_OBJECT_URL_REQUEST",
    downloadKey,
    mimeType
  } satisfies ExtensionMessage)) as ExtensionMessage;

  if (response.type === "ERROR") throw new Error(response.message);
  if (response.type !== "CREATE_OBJECT_URL_RESULT") {
    throw new Error("Unexpected response while preparing the download.");
  }
  return response.objectUrl;
}

function revokeObjectUrl(objectUrl: string): void {
  chrome.runtime
    .sendMessage({ type: "REVOKE_OBJECT_URL_REQUEST", objectUrl } satisfies ExtensionMessage)
    .catch(() => undefined);
}

/** Saves data to disk through the Chrome Downloads API (never fabricates a
 *  network request that bypasses auth — the bytes are produced locally from
 *  already-fetched/generated content).
 *
 *  chrome.downloads is only available here in the service worker — offscreen
 *  documents (see offscreen/offscreen.ts) only have chrome.runtime, so this
 *  asks the offscreen document just to mint a blob: URL from the staged
 *  bytes, then drives the actual download itself.
 *
 *  The bytes never go through chrome.runtime.sendMessage — its JSON-based
 *  serializer can't reliably carry a large binary payload (a Blob arrives
 *  broken, "Overload resolution failed"; a large Uint8Array can fail to
 *  serialize outright, "Could not serialize message"). Instead they're
 *  staged in IndexedDB, which both this service worker and the offscreen
 *  document can read directly since they share the same extension origin —
 *  only a small reference key crosses the message channel. */
export async function saveBlobToDownloads(
  bytes: Uint8Array,
  filename: string,
  {
    conflictAction = "uniquify",
    mimeType = "application/zip"
  }: { conflictAction?: chrome.downloads.FilenameConflictAction; mimeType?: string } = {}
): Promise<DownloadResult> {
  await ensureOffscreenDocument();

  const downloadKey = `dl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  await idbSet(STORES.downloads, downloadKey, bytes);

  let objectUrl: string | undefined;
  try {
    objectUrl = await requestObjectUrl(downloadKey, mimeType);

    const downloadId = await new Promise<number>((resolve, reject) => {
      chrome.downloads.download({ url: objectUrl!, filename, conflictAction, saveAs: false }, (id) => {
        if (chrome.runtime.lastError || id === undefined) {
          reject(new Error(chrome.runtime.lastError?.message ?? "Download failed to start"));
          return;
        }

        const listener = (delta: chrome.downloads.DownloadDelta): void => {
          if (delta.id !== id) return;
          if (delta.state?.current === "complete") {
            chrome.downloads.onChanged.removeListener(listener);
            resolve(id);
          } else if (delta.state?.current === "interrupted") {
            chrome.downloads.onChanged.removeListener(listener);
            chrome.downloads.resume(id, () => {
              if (chrome.runtime.lastError) {
                reject(new Error(`Download interrupted: ${filename}`));
              } else {
                resolve(id);
              }
            });
          }
        };
        chrome.downloads.onChanged.addListener(listener);
      });
    });

    return { downloadId, filename };
  } finally {
    if (objectUrl) revokeObjectUrl(objectUrl);
    await idbDelete(STORES.downloads, downloadKey).catch(() => undefined);
  }
}
