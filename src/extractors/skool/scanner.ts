import { textOf, toAbsoluteUrl } from "@/utils/dom";

export function isSkoolHost(url: string): boolean {
  return /(^|\.)skool\.com$/i.test(new URL(url).hostname);
}

export function isClassroomPage(url = window.location.href): boolean {
  return isSkoolHost(url) && /\/classroom(\/|$)/.test(new URL(url).pathname);
}

/**
 * Skool's classroom root page (`/<group>/classroom`) renders each module as a
 * `role="button"` draggable card with no `href` at all — the navigation is a
 * JS-only click handler, so there's nothing to scan statically. This finds
 * those cards and returns just their visible title/description text; the
 * background orchestrator drives an actual click + navigation per card (see
 * background/moduleScanner.ts) since only it can survive/force a real page
 * navigation.
 */
export function findModuleEntries(): { index: number; title: string }[] {
  const cards = Array.from(
    document.querySelectorAll('[role="button"][aria-roledescription="sortable"]')
  );
  return cards
    .map((card, index) => {
      // Leaf elements in document order approximate innerText's line-by-line
      // reading order without relying on innerText (unsupported in jsdom).
      const leafTexts = Array.from(card.querySelectorAll<HTMLElement>("*"))
        .filter((el) => el.children.length === 0)
        .map((el) => el.textContent?.trim() ?? "")
        .filter((text) => text.length > 0 && !/^\d+%/.test(text));
      const title = leafTexts[0];
      return title ? { index, title } : null;
    })
    .filter((entry): entry is { index: number; title: string } => entry !== null);
}

export function clickModuleEntry(index: number): void {
  const cards = document.querySelectorAll<HTMLElement>(
    '[role="button"][aria-roledescription="sortable"]'
  );
  const card = cards[index];
  if (!card) throw new Error(`No module card at index ${index}`);
  card.click();
}

/**
 * The one durable selector across Skool's classroom UI: every lesson link,
 * wherever it appears (root grid, module lesson list, etc.), carries a
 * `?md=<lessonId>` query param. Hashed styled-components class names are not
 * relied on here at all.
 */
export function scanVisibleLessons(): { title: string; url: string }[] {
  const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="?md="]'));
  const seen = new Set<string>();
  const lessons: { title: string; url: string }[] = [];

  for (const anchor of anchors) {
    const href = anchor.getAttribute("href");
    if (!href) continue;
    const url = toAbsoluteUrl(href);
    if (seen.has(url)) continue;
    seen.add(url);

    const titleEl = anchor.querySelector<HTMLElement>("[title]");
    const title = titleEl?.getAttribute("title") || textOf(anchor);
    lessons.push({ title: title || "Untitled Lesson", url });
  }

  return lessons;
}
