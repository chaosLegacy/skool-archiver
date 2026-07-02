import { textOf, toAbsoluteUrl } from "@/utils/dom";
import { sleep } from "@/utils/time";

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

/** These cards are `aria-roledescription="sortable"` — react-beautiful-dnd
 *  draggables, which are notoriously unreliable about firing their click
 *  handler for anything short of a genuinely trusted, OS-level input event.
 *  Rather than dispatch a synthetic click here (which repeatedly did
 *  nothing), this just scrolls the target into view and hands back its
 *  on-screen center; the background then dispatches a real click there via
 *  chrome.debugger (see background/trustedClick.ts), which behaves exactly
 *  like a genuine user click. */
export async function getModuleEntryPosition(index: number): Promise<{ x: number; y: number }> {
  const cards = document.querySelectorAll<HTMLElement>(
    '[role="button"][aria-roledescription="sortable"]'
  );
  const card = cards[index];
  if (!card) throw new Error(`No module card at index ${index}`);

  // jsdom (test environment) doesn't implement scrollIntoView; real
  // browsers always do.
  card.scrollIntoView?.({ block: "center", behavior: "instant" });
  await sleep(150);

  const rect = card.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/** Polls for lesson links to show up after a (possibly client-side-routed)
 *  navigation, rather than guessing a fixed delay. Resolves with whatever it
 *  finds — an empty list if nothing appeared within the timeout. */
export async function waitForVisibleLessons(
  timeoutMs = 6000,
  intervalMs = 250
): Promise<{ title: string; url: string }[]> {
  const deadline = Date.now() + timeoutMs;
  let lessons = scanVisibleLessons();
  while (lessons.length === 0 && Date.now() < deadline) {
    await sleep(intervalMs);
    lessons = scanVisibleLessons();
  }
  return lessons;
}

/** Waits for the first lessons to render, then scrolls to pick up the rest
 *  of a long/virtualized list. The one entry point used for every "read the
 *  current page's lessons" step, whether that's right after a click or the
 *  single-module fallback scan. */
export async function waitThenScanAllLessons(
  waitTimeoutMs = 6000
): Promise<{ title: string; url: string }[]> {
  await waitForVisibleLessons(waitTimeoutMs);
  return scanAllLessonsWithScroll();
}

/**
 * Long lesson lists may only keep a subset of items mounted in the DOM at
 * once (virtualized/lazily-rendered rows), so a single static scan can miss
 * everything past the initial viewport — matching reports of modules coming
 * back with only their first few lessons. This scrolls whichever container
 * holds the lesson links (or the window, if the list isn't in its own
 * scroll container) in increments, re-scanning after each, and stops once a
 * few consecutive scrolls stop turning up anything new or the bottom is
 * reached — rather than guessing a fixed number of scrolls.
 */
export async function scanAllLessonsWithScroll(
  maxDurationMs = 20000
): Promise<{ title: string; url: string }[]> {
  const found = new Map<string, { title: string; url: string }>();
  const collect = (): void => {
    for (const lesson of scanVisibleLessons()) found.set(lesson.url, lesson);
  };
  collect();

  const scrollable = findScrollContainer();
  const deadline = Date.now() + maxDurationMs;
  let stableRounds = 0;

  while (Date.now() < deadline && stableRounds < 3) {
    const before = found.size;
    const atBottom = scrollDown(scrollable);
    await sleep(350);
    collect();

    if (found.size === before) stableRounds++;
    else stableRounds = 0;
    if (atBottom && found.size === before) break;
  }

  return Array.from(found.values());
}

function findScrollContainer(): Element | null {
  const anchors = document.querySelectorAll<HTMLAnchorElement>('a[href*="?md="]');
  for (const anchor of anchors) {
    let el: Element | null = anchor.parentElement;
    while (el && el !== document.body) {
      if (el.scrollHeight > el.clientHeight + 4) return el;
      el = el.parentElement;
    }
  }
  return null; // fall back to scrolling the window itself
}

/** Returns true if the scroll position is already at (or past) the bottom. */
function scrollDown(container: Element | null): boolean {
  if (container) {
    const before = container.scrollTop;
    container.scrollTop += container.clientHeight * 0.8;
    const atBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 2;
    return atBottom && container.scrollTop === before;
  }
  const before = window.scrollY;
  // jsdom (test environment) doesn't implement scrollBy; real browsers always do.
  window.scrollBy?.(0, window.innerHeight * 0.8);
  const atBottom =
    window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
  return atBottom && window.scrollY === before;
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
