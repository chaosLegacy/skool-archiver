import type { PlatformExtractor } from "./types";
import { skoolExtractor } from "./skool";

/** Registry of supported LMS platforms. Add new platforms here without
 *  touching content/background/exporter code. */
const PLATFORM_EXTRACTORS: PlatformExtractor[] = [skoolExtractor];

export function getExtractorForUrl(url: string): PlatformExtractor | null {
  return PLATFORM_EXTRACTORS.find((extractor) => extractor.matches(url)) ?? null;
}

export type { PlatformExtractor } from "./types";
