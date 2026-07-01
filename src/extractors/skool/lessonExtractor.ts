import type { ExtractedLesson, LessonMeta } from "@/types";
import { textOf } from "@/utils/dom";
import { extractBody } from "../blocks/body";

const TWO_SEGMENT_PATH = /^\/[^/?#]+\/[^/?#]+$/;
const PROFILE_PATH = /^\/@/;

/**
 * Skool's classroom `?md=` page shows the module's lesson list and the
 * selected lesson's content side by side (the lesson content is really a
 * community "post"). There's no stable hashed class name to key off, so this
 * locates the content pane structurally: it's the sibling of whichever
 * container holds all the `?md=` lesson links, and the richest such sibling
 * by text length is treated as the content root.
 */
function findLessonContentRoot(): HTMLElement {
  const lessonLinks = Array.from(document.querySelectorAll('a[href*="?md="]'));
  if (lessonLinks.length === 0) return document.body;

  let listContainer: Element = lessonLinks[0]!;
  for (const link of lessonLinks) {
    while (!listContainer.contains(link)) {
      const parent: Element | null = listContainer.parentElement;
      if (!parent) return document.body;
      listContainer = parent;
    }
  }

  let node: Element | null = listContainer;
  while (node?.parentElement) {
    const siblings = Array.from(node.parentElement.children).filter((el) => el !== node);
    const candidate = siblings.reduce<Element | null>((best, el) => {
      const len = el.textContent?.length ?? 0;
      const bestLen = best?.textContent?.length ?? 0;
      return len > bestLen ? el : best;
    }, null);
    if (candidate && (candidate.textContent?.length ?? 0) > 80) {
      return candidate as HTMLElement;
    }
    node = node.parentElement;
  }
  return document.body;
}

function findTitleAnchor(root: HTMLElement): HTMLAnchorElement | undefined {
  return Array.from(root.querySelectorAll<HTMLAnchorElement>("a[href]")).find((a) => {
    const href = a.getAttribute("href") ?? "";
    return TWO_SEGMENT_PATH.test(href) && !PROFILE_PATH.test(href);
  });
}

function findAuthorAnchor(root: HTMLElement): HTMLAnchorElement | undefined {
  return root.querySelector<HTMLAnchorElement>('a[href^="/@"]') ?? undefined;
}

/** Extracts full content from the current document, which is assumed to
 *  already be the rendered `?md=` lesson page. */
export function extractCurrentLessonFromDom(meta: LessonMeta): ExtractedLesson {
  const contentRoot = findLessonContentRoot();

  const titleAnchor = findTitleAnchor(contentRoot);
  const authorAnchor = findAuthorAnchor(contentRoot);
  const authorNameEl = authorAnchor?.querySelector("[title]");

  const { blocks, images, videos, links, attachments } = extractBody(contentRoot);

  return {
    ...meta,
    title: (titleAnchor && textOf(titleAnchor)) || meta.title,
    author: authorNameEl?.getAttribute("title") ?? undefined,
    blocks,
    images,
    videos,
    links,
    attachments
  };
}
