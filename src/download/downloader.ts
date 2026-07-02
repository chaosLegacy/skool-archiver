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

/** Saves a Blob to disk through the Chrome Downloads API (never fabricates a
 *  network request that bypasses auth — the blob is produced locally from
 *  already-fetched/generated content). The actual save happens in the
 *  offscreen document (see offscreen/offscreen.ts); this just relays the
 *  Blob there and back, since chrome.runtime messages support structured
 *  clone (Blob included). */
export async function saveBlobToDownloads(
  blob: Blob,
  filename: string,
  { conflictAction = "uniquify" }: { conflictAction?: chrome.downloads.FilenameConflictAction } = {}
): Promise<DownloadResult> {
  await ensureOffscreenDocument();

  const response = (await chrome.runtime.sendMessage({
    type: "SAVE_BLOB_TO_DOWNLOADS_REQUEST",
    blob,
    filename,
    conflictAction
  } satisfies ExtensionMessage)) as ExtensionMessage;

  if (response.type === "ERROR") throw new Error(response.message);
  if (response.type !== "SAVE_BLOB_TO_DOWNLOADS_RESULT") {
    throw new Error("Unexpected response while saving the download.");
  }
  return { downloadId: response.downloadId, filename: response.filename };
}
