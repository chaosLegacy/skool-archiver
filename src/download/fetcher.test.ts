import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAsBlob } from "./fetcher";

describe("fetchAsBlob", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends credentials for Skool's own domain", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(new Blob()) });
    vi.stubGlobal("fetch", fetchMock);

    await fetchAsBlob("https://www.skool.com/some/lesson-asset.png");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://www.skool.com/some/lesson-asset.png",
      expect.objectContaining({ credentials: "include" })
    );
  });

  it("omits credentials for third-party CDNs (avoids the wildcard-CORS + credentials conflict)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(new Blob()) });
    vi.stubGlobal("fetch", fetchMock);

    await fetchAsBlob("https://i.ytimg.com/vi/abc123/hqdefault.jpg");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://i.ytimg.com/vi/abc123/hqdefault.jpg",
      expect.objectContaining({ credentials: "omit" })
    );
  });

  it("does not retry indefinitely and eventually throws", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network error"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchAsBlob("https://example.com/x.png", { retries: 1, retryDelayMs: 1 })).rejects.toThrow(
      "network error"
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
