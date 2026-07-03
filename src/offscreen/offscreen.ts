import type { ExtensionMessage } from "@/types";

/**
 * Service workers don't have URL.createObjectURL (it's a DOM/window API),
 * so a generated zip can't get a blob: URL there. This offscreen document
 * exists purely to have a real DOM to create that URL in, then hands the
 * resulting download off to chrome.downloads (also available here) exactly
 * the same way the background used to do it directly.
 *
 * The message carries raw bytes rather than a Blob on purpose: a Blob
 * constructed in the service worker doesn't survive chrome.runtime.sendMessage
 * as a real Blob instance here, and URL.createObjectURL throws "Overload
 * resolution failed" on whatever it deserializes into. Building the Blob
 * fresh, in this document, from bytes (which do clone correctly) avoids that
 * entirely.
 */
chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse: (response: ExtensionMessage) => void) => {
    if (message.type !== "SAVE_BLOB_TO_DOWNLOADS_REQUEST") return undefined;
    saveBlob(message.bytes, message.mimeType, message.filename, message.conflictAction)
      .then(sendResponse)
      .catch((error: unknown) => {
        sendResponse({
          type: "ERROR",
          message: error instanceof Error ? error.message : String(error)
        });
      });
    return true;
  }
);

async function saveBlob(
  bytes: Uint8Array,
  mimeType: string,
  filename: string,
  conflictAction: chrome.downloads.FilenameConflictAction = "uniquify"
): Promise<ExtensionMessage> {
  const blob = new Blob([bytes as unknown as BlobPart], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);

  try {
    const { downloadId } = await new Promise<{ downloadId: number }>((resolve, reject) => {
      chrome.downloads.download(
        { url: objectUrl, filename, conflictAction, saveAs: false },
        (id) => {
          if (chrome.runtime.lastError || id === undefined) {
            reject(new Error(chrome.runtime.lastError?.message ?? "Download failed to start"));
            return;
          }

          const listener = (delta: chrome.downloads.DownloadDelta) => {
            if (delta.id !== id) return;
            if (delta.state?.current === "complete") {
              chrome.downloads.onChanged.removeListener(listener);
              resolve({ downloadId: id });
            } else if (delta.state?.current === "interrupted") {
              chrome.downloads.onChanged.removeListener(listener);
              chrome.downloads.resume(id, () => {
                if (chrome.runtime.lastError) {
                  reject(new Error(`Download interrupted: ${filename}`));
                } else {
                  resolve({ downloadId: id });
                }
              });
            }
          };
          chrome.downloads.onChanged.addListener(listener);
        }
      );
    });

    return { type: "SAVE_BLOB_TO_DOWNLOADS_RESULT", downloadId, filename };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
