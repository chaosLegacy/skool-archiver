import { idbGet, STORES } from "@/storage/db";
import type { ExtensionMessage } from "@/types";

/**
 * Service workers don't have URL.createObjectURL (it's a DOM/window API), so
 * this offscreen document exists purely to have a real DOM to create one in.
 * It does NOT call chrome.downloads itself — offscreen documents only have
 * access to chrome.runtime, nothing else (by design, so they can't become a
 * background-page replacement). The actual chrome.downloads.download() call
 * happens back in the service worker (see download/downloader.ts), using the
 * object URL this document hands back.
 *
 * The request carries only a small reference key, not the actual bytes:
 * chrome.runtime.sendMessage's JSON-based serializer can't reliably carry a
 * large binary payload — a Blob arrives broken ("Overload resolution
 * failed" on URL.createObjectURL), and a large Uint8Array can fail to
 * serialize at all ("Could not serialize message"). The bytes are staged in
 * IndexedDB instead, which this document reads directly since it shares the
 * same extension origin as the service worker.
 */
chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse: (response: ExtensionMessage) => void) => {
    if (message.type === "CREATE_OBJECT_URL_REQUEST") {
      createObjectUrl(message.downloadKey, message.mimeType)
        .then(sendResponse)
        .catch((error: unknown) => {
          sendResponse({
            type: "ERROR",
            message: error instanceof Error ? error.message : String(error)
          });
        });
      return true;
    }

    if (message.type === "REVOKE_OBJECT_URL_REQUEST") {
      URL.revokeObjectURL(message.objectUrl);
      sendResponse({ type: "PING" });
      return true;
    }

    return undefined;
  }
);

async function createObjectUrl(downloadKey: string, mimeType: string): Promise<ExtensionMessage> {
  const bytes = await idbGet<Uint8Array>(STORES.downloads, downloadKey);
  if (!bytes) {
    throw new Error("Could not find the archive data to download — please try again.");
  }
  const blob = new Blob([bytes as unknown as BlobPart], { type: mimeType });
  return { type: "CREATE_OBJECT_URL_RESULT", objectUrl: URL.createObjectURL(blob) };
}
