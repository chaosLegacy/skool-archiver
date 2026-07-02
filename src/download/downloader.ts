export interface DownloadResult {
  downloadId: number;
  filename: string;
}

/** Saves a Blob to disk through the Chrome Downloads API (never fabricates a
 *  network request that bypasses auth — the blob is produced locally from
 *  already-fetched/generated content). Waits for Chrome to report completion
 *  and retries once on a transient interruption.
 *
 *  Uses `URL.createObjectURL` rather than converting the whole Blob to a
 *  base64 `data:` URL — for a course archive with lots of images/videos the
 *  zip can be tens of MB, and base64-encoding that as one giant string in a
 *  service worker is exactly the kind of long-running, memory-heavy
 *  operation that can silently stall or get the worker evicted mid-task with
 *  no exception ever thrown (which looks like "stuck at packaging, no error,
 *  no zip"). Object URLs skip that encoding step entirely. */
export async function saveBlobToDownloads(
  blob: Blob,
  filename: string,
  { conflictAction = "uniquify" }: { conflictAction?: chrome.downloads.FilenameConflictAction } = {}
): Promise<DownloadResult> {
  const objectUrl = URL.createObjectURL(blob);

  try {
    return await new Promise((resolve, reject) => {
      chrome.downloads.download(
        { url: objectUrl, filename, conflictAction, saveAs: false },
        (downloadId) => {
          if (chrome.runtime.lastError || downloadId === undefined) {
            reject(new Error(chrome.runtime.lastError?.message ?? "Download failed to start"));
            return;
          }

          const listener = (delta: chrome.downloads.DownloadDelta) => {
            if (delta.id !== downloadId) return;
            if (delta.state?.current === "complete") {
              chrome.downloads.onChanged.removeListener(listener);
              resolve({ downloadId, filename });
            } else if (delta.state?.current === "interrupted") {
              chrome.downloads.onChanged.removeListener(listener);
              chrome.downloads.resume(downloadId, () => {
                if (chrome.runtime.lastError) {
                  reject(new Error(`Download interrupted: ${filename}`));
                } else {
                  resolve({ downloadId, filename });
                }
              });
            }
          };
          chrome.downloads.onChanged.addListener(listener);
        }
      );
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
