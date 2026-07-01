import type { CourseSummary, LessonMeta, ModuleSummary } from "@/types";
import { idFromUrl, slugify } from "@/utils/id";
import { sleep } from "@/utils/time";
import { navigateTab, sendToTab, waitForTabComplete } from "./tabMessaging";

/**
 * Skool's classroom root page renders each module as a click-only card with
 * no `href` (see extractors/skool/scanner.ts findModuleEntries). Discovering
 * every module's lessons therefore means actually clicking each card and
 * reading the page that results — which only the background service worker
 * can drive, since a real navigation would tear down a content script mid
 * function. This forces the tab back to `rootUrl` between every module so
 * behavior doesn't depend on guessing whether Skool's internal routing is a
 * full reload or a client-side transition.
 */
export async function scanSkoolCourse(tabId: number, rootUrl: string): Promise<CourseSummary> {
  const tab = await chrome.tabs.get(tabId);
  const courseTitle = tab.title?.replace(/\s*[|·-]\s*Skool.*$/i, "").trim() || "Untitled Course";

  const entriesRes = await sendToTab<{ type: "MODULE_ENTRIES_RESULT"; entries: { index: number; title: string }[] }>(
    tabId,
    { type: "GET_MODULE_ENTRIES" }
  );

  const modules: ModuleSummary[] = [];

  if (entriesRes.entries.length === 0) {
    // No click-only cards found — the user is likely already inside a single
    // module's lesson list. Scan just what's currently visible.
    const lessons = await scanVisibleLessons(tabId, "Module 1", 0);
    if (lessons.lessons.length === 0) {
      throw new Error("Could not find any modules/lessons on this page.");
    }
    modules.push(lessons);
    return { id: idFromUrl(rootUrl), title: courseTitle, url: rootUrl, modules };
  }

  for (const entry of entriesRes.entries) {
    await navigateTab(tabId, rootUrl);
    await waitForTabComplete(tabId).catch(() => undefined);

    await sendToTab(tabId, { type: "CLICK_MODULE_ENTRY", index: entry.index });
    // Settles whether Skool does a hard reload (waitForTabComplete resolves)
    // or a client-side transition (the fixed sleep gives it time to render).
    await Promise.race([waitForTabComplete(tabId, 8000).catch(() => undefined), sleep(2500)]);

    const moduleSummary = await scanVisibleLessons(tabId, entry.title, modules.length);
    if (moduleSummary.lessons.length > 0) modules.push(moduleSummary);
  }

  await navigateTab(tabId, rootUrl);
  await waitForTabComplete(tabId).catch(() => undefined);

  if (modules.length === 0) {
    throw new Error("Found module cards but no lessons inside any of them.");
  }

  return { id: idFromUrl(rootUrl), title: courseTitle, url: rootUrl, modules };
}

async function scanVisibleLessons(
  tabId: number,
  moduleTitle: string,
  order: number
): Promise<ModuleSummary> {
  const res = await sendToTab<{ type: "VISIBLE_LESSONS_RESULT"; lessons: { title: string; url: string }[] }>(
    tabId,
    { type: "SCAN_VISIBLE_LESSONS_REQUEST" }
  );

  const moduleId = `module_${order}_${slugify(moduleTitle)}`;
  const lessons: LessonMeta[] = res.lessons.map((lesson, index) => ({
    id: idFromUrl(lesson.url),
    title: lesson.title,
    url: lesson.url,
    moduleId,
    moduleTitle,
    order: index
  }));

  return { id: moduleId, title: moduleTitle, order, lessons };
}
