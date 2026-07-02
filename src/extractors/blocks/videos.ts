import type { VideoProvider, VideoRef } from "@/types";
import { attrOf, toAbsoluteUrl } from "@/utils/dom";

const PROVIDER_PATTERNS: Array<{ provider: VideoProvider; test: RegExp }> = [
  { provider: "youtube", test: /(youtube\.com|youtu\.be)/i },
  { provider: "vimeo", test: /vimeo\.com/i },
  { provider: "loom", test: /loom\.com/i },
  { provider: "wistia", test: /wistia\.(com|net)/i }
];

function detectProvider(src: string): VideoProvider {
  const match = PROVIDER_PATTERNS.find(({ test }) => test.test(src));
  return match?.provider ?? "unknown";
}

/**
 * Embedded iframe players (YouTube/Vimeo/Loom/Wistia) stream through the
 * provider's protected player — there is no legitimate, non-DRM-circumventing
 * way to pull a local file out of the DOM for these. We surface that clearly
 * instead of attempting any workaround.
 */
export function extractIframeVideo(iframe: HTMLIFrameElement): VideoRef | null {
  const src = attrOf(iframe, "src");
  if (!src) return null;
  const provider = detectProvider(src);
  if (provider === "unknown") return null;

  return {
    provider,
    embedUrl: toAbsoluteUrl(src),
    title: attrOf(iframe, "title"),
    protected: true,
    reason:
      "Embedded provider stream (protected player) — cannot be saved without bypassing the provider's protections. Use the provider's own download/offline feature if it offers one."
  };
}

const THUMBNAIL_HOST_PATTERNS: Array<{ provider: VideoProvider; test: RegExp }> = [
  { provider: "youtube", test: /i\.ytimg\.com/i },
  { provider: "vimeo", test: /vimeocdn\.com/i },
  { provider: "wistia", test: /wistia\.(com|net)/i },
  { provider: "loom", test: /loom\.com/i }
];

/**
 * Many embed players (Skool included) don't mount a real `<video>`/`<iframe>`
 * until the user clicks play — the initial DOM only has a thumbnail image
 * (as a CSS `background-image`) with a play icon on top. Extraction runs
 * without any interaction, so these would otherwise be silently invisible to
 * every other video extractor here. Surfacing them as a protected VideoRef
 * at least tells the user a video exists instead of dropping it entirely.
 */
export function extractThumbnailVideo(el: HTMLElement): VideoRef | null {
  const style = el.getAttribute("style") ?? "";
  const match = style.match(/background-image:\s*url\((['"]?)([^'")]+)\1\)/i);
  if (!match) return null;
  const thumbnailUrl = match[2];
  if (!thumbnailUrl) return null;

  const hit = THUMBNAIL_HOST_PATTERNS.find(({ test }) => test.test(thumbnailUrl));
  if (!hit) return null;

  let embedUrl: string | undefined;
  if (hit.provider === "youtube") {
    const idMatch = thumbnailUrl.match(/\/vi\/([^/]+)\//);
    if (idMatch?.[1]) embedUrl = `https://www.youtube.com/watch?v=${idMatch[1]}`;
  }

  return {
    provider: hit.provider,
    embedUrl,
    thumbnailUrl,
    title: attrOf(el, "alt"),
    protected: true,
    reason:
      "Video is shown as a click-to-play thumbnail and isn't loaded into the page until played — archiving can't click through every video, so it can't be saved automatically."
  };
}

/** Native <video> elements can sometimes be saved directly when they expose a
 *  real network URL. Blob/MediaSource URLs indicate adaptive/DRM-guarded
 *  streaming and are reported as not downloadable rather than intercepted. */
export function extractHtml5Video(video: HTMLVideoElement): VideoRef | null {
  const directSrc = attrOf(video, "src");
  const sourceEl = video.querySelector("source");
  const src = directSrc || attrOf(sourceEl ?? undefined, "src");
  if (!src) return null;

  if (src.startsWith("blob:") || src.startsWith("mediasource:")) {
    return {
      provider: "html5",
      protected: true,
      reason:
        "Video is served via a blob/MediaSource stream (adaptive or DRM-guarded). It cannot be saved through normal browser downloads."
    };
  }

  return {
    provider: "html5",
    sourceUrl: toAbsoluteUrl(src),
    protected: false
  };
}
