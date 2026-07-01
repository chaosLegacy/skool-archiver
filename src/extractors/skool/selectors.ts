/**
 * Skool's classroom UI is a client-rendered React app with hashed/utility
 * class names that shift between deploys, so selectors here are intentionally
 * layered: a handful of "best guess" structural selectors are tried in order,
 * and scanner/extractor code falls back to heuristics (largest text block,
 * nearest heading, etc.) when none match. If Skool changes its markup, update
 * this file first — nothing else in the pipeline should need to change.
 */
export const SKOOL_SELECTORS = {
  classroomRoot: ['[class*="classroom"]', "main"],
  moduleGroup: [
    '[class*="classroom-section"]',
    '[class*="module"]',
    "[data-module-id]"
  ],
  moduleTitle: ['[class*="section-title"]', '[class*="module-title"]', "h2", "h3"],
  lessonLink: [
    'a[href*="/classroom/"]',
    'a[href*="/c/"]',
    '[class*="lesson-item"] a'
  ],
  lessonContentRoot: [
    '[class*="lesson-content"]',
    '[class*="post-content"]',
    "article",
    "main"
  ],
  lessonTitle: ['[class*="lesson-title"]', "h1"],
  lessonSubtitle: ['[class*="lesson-subtitle"]', '[class*="subtitle"]'],
  lessonAuthor: ['[class*="author-name"]', '[class*="user-name"]'],
  lessonDate: ["time", '[class*="date"]']
} as const;

export function querySelectorFirst(root: ParentNode, selectors: readonly string[]): Element | null {
  for (const selector of selectors) {
    const found = root.querySelector(selector);
    if (found) return found;
  }
  return null;
}

export function querySelectorAllFirst(
  root: ParentNode,
  selectors: readonly string[]
): Element[] {
  for (const selector of selectors) {
    const found = root.querySelectorAll(selector);
    if (found.length) return Array.from(found);
  }
  return [];
}
