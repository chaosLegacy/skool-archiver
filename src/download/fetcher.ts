import { sleep } from "@/utils/time";

export interface FetchBlobOptions {
  retries?: number;
  retryDelayMs?: number;
}

/** Only Skool's own domain needs the logged-in session's cookies — lesson
 *  images/videos are commonly hosted on third-party CDNs (YouTube thumbnails,
 *  Giphy, Contentful, etc.) that serve `Access-Control-Allow-Origin: *`.
 *  That wildcard is specifically disallowed on credentialed requests (a CORS
 *  spec rule, not a permissions issue), so sending cookies to those origins
 *  makes an otherwise-fine public fetch fail outright — and since it's a
 *  deterministic policy violation, retrying it never helps. */
function needsCredentials(url: string): boolean {
  try {
    return /(^|\.)skool\.com$/i.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** Fetches a resource as a Blob, including the page's session cookies only
 *  for Skool's own domain. Never bypasses auth — it only works because the
 *  browser is already logged in. */
export async function fetchAsBlob(
  url: string,
  { retries = 2, retryDelayMs = 1000 }: FetchBlobOptions = {}
): Promise<Blob> {
  const credentials = needsCredentials(url) ? "include" : "omit";
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, { credentials });
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
