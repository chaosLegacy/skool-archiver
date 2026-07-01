import type { ImageRef } from "@/types";
import { attrOf, toAbsoluteUrl } from "@/utils/dom";

export function extractImage(el: HTMLImageElement): ImageRef | null {
  const src = attrOf(el, "src") || attrOf(el, "data-src");
  if (!src || src.startsWith("data:")) return null;
  return {
    originalUrl: toAbsoluteUrl(src),
    alt: attrOf(el, "alt")
  };
}
