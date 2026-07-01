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
