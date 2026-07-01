import type { ExtractedLesson, LessonMeta } from "@/types";
import { textOf } from "@/utils/dom";
import { extractBody } from "../blocks/body";
import { SKOOL_SELECTORS, querySelectorFirst } from "./selectors";

/** Extracts full content from the current document, which is assumed to
 *  already be the rendered lesson page (the caller is responsible for
 *  navigating there and waiting for content to load). */
export function extractCurrentLessonFromDom(meta: LessonMeta): ExtractedLesson {
  const contentRoot =
    (querySelectorFirst(document, SKOOL_SELECTORS.lessonContentRoot) as HTMLElement | null) ??
    document.body;

  const titleEl = querySelectorFirst(document, SKOOL_SELECTORS.lessonTitle);
  const subtitleEl = querySelectorFirst(document, SKOOL_SELECTORS.lessonSubtitle);
  const authorEl = querySelectorFirst(document, SKOOL_SELECTORS.lessonAuthor);
  const dateEl = querySelectorFirst(document, SKOOL_SELECTORS.lessonDate);

  const { blocks, images, videos, links, attachments } = extractBody(contentRoot);

  return {
    ...meta,
    title: textOf(titleEl) || meta.title,
    subtitle: subtitleEl ? textOf(subtitleEl) : undefined,
    author: authorEl ? textOf(authorEl) : undefined,
    publishDate: dateEl ? dateEl.getAttribute("datetime") ?? textOf(dateEl) : undefined,
    blocks,
    images,
    videos,
    links,
    attachments
  };
}
