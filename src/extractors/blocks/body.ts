import type {
  AttachmentRef,
  ContentBlock,
  ImageRef,
  LinkRef,
  VideoRef
} from "@/types";
import { textOf } from "@/utils/dom";
import { extractCodeBlock } from "./codeBlocks";
import { extractImage } from "./images";
import { extractAttachment, extractLink, isAttachmentLink } from "./links";
import { extractQuote } from "./quotes";
import { extractTable } from "./tables";
import { extractHtml5Video, extractIframeVideo } from "./videos";

const HEADING_TAGS = new Set(["H1", "H2", "H3", "H4", "H5", "H6"]);

export interface BodyExtractionResult {
  blocks: ContentBlock[];
  images: ImageRef[];
  videos: VideoRef[];
  links: LinkRef[];
  attachments: AttachmentRef[];
}

/** Walks a lesson content root in document order, converting recognized
 *  elements into ordered content blocks while collecting flat resource lists
 *  used by the download pipeline. Skips elements already consumed as part of
 *  a parent block (e.g. an <img> inside a <figure>) to avoid duplicates. */
export function extractBody(root: HTMLElement): BodyExtractionResult {
  const blocks: ContentBlock[] = [];
  const images: ImageRef[] = [];
  const videos: VideoRef[] = [];
  const links: LinkRef[] = [];
  const attachments: AttachmentRef[] = [];
  const consumed = new Set<Element>();

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let node = walker.nextNode() as Element | null;

  while (node) {
    const el = node;
    if (consumed.has(el)) {
      node = walker.nextNode() as Element | null;
      continue;
    }

    if (HEADING_TAGS.has(el.tagName)) {
      const level = Number(el.tagName[1]) as 1 | 2 | 3 | 4 | 5 | 6;
      blocks.push({ type: "heading", level, text: textOf(el) });
      markSubtreeConsumed(el, consumed);
    } else if (el.tagName === "P") {
      const text = textOf(el);
      if (text) blocks.push({ type: "paragraph", text });
      collectInlineResources(el, { images, videos, links, attachments, consumed });
    } else if (el.tagName === "UL" || el.tagName === "OL") {
      const items = Array.from(el.querySelectorAll(":scope > li")).map(textOf);
      blocks.push({ type: "list", ordered: el.tagName === "OL", items });
      markSubtreeConsumed(el, consumed);
    } else if (el.tagName === "TABLE") {
      const ref = extractTable(el as HTMLTableElement);
      blocks.push({ type: "table", ref });
      markSubtreeConsumed(el, consumed);
    } else if (el.tagName === "PRE") {
      const ref = extractCodeBlock(el as HTMLPreElement);
      blocks.push({ type: "code", ref });
      markSubtreeConsumed(el, consumed);
    } else if (el.tagName === "BLOCKQUOTE") {
      const ref = extractQuote(el as HTMLQuoteElement);
      blocks.push({ type: "quote", ref });
      markSubtreeConsumed(el, consumed);
    } else if (el.tagName === "IMG") {
      const ref = extractImage(el as HTMLImageElement);
      if (ref) {
        blocks.push({ type: "image", ref });
        images.push(ref);
      }
    } else if (el.tagName === "IFRAME") {
      const ref = extractIframeVideo(el as HTMLIFrameElement);
      if (ref) {
        blocks.push({ type: "video", ref });
        videos.push(ref);
      }
    } else if (el.tagName === "VIDEO") {
      const ref = extractHtml5Video(el as HTMLVideoElement);
      if (ref) {
        blocks.push({ type: "video", ref });
        videos.push(ref);
      }
      markSubtreeConsumed(el, consumed);
    } else if (el.tagName === "A") {
      if (isAttachmentLink(el as HTMLAnchorElement)) {
        const ref = extractAttachment(el as HTMLAnchorElement);
        if (ref) attachments.push(ref);
      } else {
        const ref = extractLink(el as HTMLAnchorElement);
        if (ref) links.push(ref);
      }
    }

    node = walker.nextNode() as Element | null;
  }

  return { blocks, images, videos, links, attachments };
}

function markSubtreeConsumed(root: Element, consumed: Set<Element>): void {
  consumed.add(root);
  root.querySelectorAll("*").forEach((child) => consumed.add(child));
}

function collectInlineResources(
  root: Element,
  sink: {
    images: ImageRef[];
    videos: VideoRef[];
    links: LinkRef[];
    attachments: AttachmentRef[];
    consumed: Set<Element>;
  }
): void {
  root.querySelectorAll("img").forEach((img) => {
    const ref = extractImage(img as HTMLImageElement);
    if (ref) sink.images.push(ref);
  });
  root.querySelectorAll("a").forEach((a) => {
    if (isAttachmentLink(a as HTMLAnchorElement)) {
      const ref = extractAttachment(a as HTMLAnchorElement);
      if (ref) sink.attachments.push(ref);
    } else {
      const ref = extractLink(a as HTMLAnchorElement);
      if (ref) sink.links.push(ref);
    }
  });
  markSubtreeConsumed(root, sink.consumed);
}
