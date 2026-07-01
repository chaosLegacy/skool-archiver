function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read blob"));
    reader.readAsDataURL(blob);
  });
}

export interface DownloadResult {
  downloadId: number;
  filename: string;
}

/** Saves a Blob to disk through the Chrome Downloads API (never fabricates a
 *  network request that bypasses auth — the blob is produced locally from
 *  already-fetched/generated content). Waits for Chrome to report completion
 *  and retries once on a transient interruption. */
export async function saveBlobToDownloads(
  blob: Blob,
  filename: string,
  { conflictAction = "uniquify" }: { conflictAction?: chrome.downloads.FilenameConflictAction } = {}
): Promise<DownloadResult> {
  const dataUrl = await blobToDataUrl(blob);

  return new Promise((resolve, reject) => {
    chrome.downloads.download(
      { url: dataUrl, filename, conflictAction, saveAs: false },
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
}
