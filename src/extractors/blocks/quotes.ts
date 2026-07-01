import type { QuoteRef } from "@/types";
import { textOf } from "@/utils/dom";

export function extractQuote(blockquote: HTMLQuoteElement): QuoteRef {
  const cite = blockquote.querySelector("cite, footer");
  return {
    text: textOf(blockquote).replace(textOf(cite ?? undefined), "").trim(),
    author: cite ? textOf(cite) : undefined
  };
}
