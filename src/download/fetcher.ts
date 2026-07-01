import { sleep } from "@/utils/time";

export interface FetchBlobOptions {
  retries?: number;
  retryDelayMs?: number;
}

/** Fetches a same-origin/authorized resource as a Blob using the page's
 *  existing session cookies (credentials: "include"). Never bypasses auth —
 *  it only works because the browser is already logged in. */
export async function fetchAsBlob(
  url: string,
  { retries = 2, retryDelayMs = 1000 }: FetchBlobOptions = {}
): Promise<Blob> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status} for ${url}`);
      }
      return await response.blob();
    } catch (error) {
      lastError = error;
      if (attempt < retries) await sleep(retryDelayMs * (attempt + 1));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Failed to fetch ${url}`);
}
