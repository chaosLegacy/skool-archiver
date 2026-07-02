import type { CourseSummary, LessonMeta, ModuleSummary } from "@/types";
import { idFromUrl, slugify } from "@/utils/id";
import { navigateTab, sendToTab, waitForTabComplete } from "./tabMessaging";
import { attachDebugger, detachDebugger, dispatchTrustedClick } from "./trustedClick";

interface RawLesson {
  title: string;
  url: string;
}

/**
 * Skool's classroom root page renders each module as a click-only card with
 * no `href` (see extractors/skool/scanner.ts findModuleEntries). Discovering
 * every module's lessons therefore means actually clicking each card and
 * reading the page that results — which only the background service worker
 * can drive, both because a real navigation would tear down a content script
 * mid function, and because a genuinely trusted click (chrome.debugger) can
 * only be dispatched from here. Forces the tab back to `rootUrl` between
 * every module so behavior doesn't depend on guessing whether Skool's
 * internal routing is a full reload or a client-side transition, and treats
 * each card's failure as isolated so one bad card doesn't sink the whole scan.
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
    const lessons = await requestVisibleLessons(tabId);
    if (lessons.length === 0) {
      throw new Error("Could not find any modules/lessons on this page.");
    }
    modules.push(buildModuleSummary("Module 1", lessons, 0));
    return { id: idFromUrl(rootUrl), title: courseTitle, url: rootUrl, modules };
  }

  const failures: string[] = [];

  await attachDebugger(tabId);
  try {
    for (const entry of entriesRes.entries) {
      try {
        const lessons = await scanOneModule(tabId, rootUrl, entry.index);
        if (lessons.length > 0) {
          modules.push(buildModuleSummary(entry.title, lessons, modules.length));
        } else {
          failures.push(entry.title);
        }
      } catch (error) {
        console.warn(`Skool Archiver: failed to scan module "${entry.title}"`, error);
        failures.push(entry.title);
      }
    }
  } finally {
    await detachDebugger(tabId);
  }

  await navigateTab(tabId, rootUrl);
  await waitForTabComplete(tabId).catch(() => undefined);

  if (modules.length === 0) {
    const cardList = entriesRes.entries.map((e) => e.title).join(", ");
    throw new Error(
      `Found module cards (${cardList}) but couldn't open any of them to read their lessons. ` +
        "Skool's classroom UI may have changed — try opening one module manually, scanning again, " +
        "and sharing what happens."
    );
  }
  if (failures.length > 0) {
    console.warn(`Skool Archiver: skipped modules with no reachable lessons: ${failures.join(", ")}`);
  }

  return { id: idFromUrl(rootUrl), title: courseTitle, url: rootUrl, modules };
}

/** Clicks one module card (via a trusted chrome.debugger click — plain
 *  synthetic events don't reliably trigger react-beautiful-dnd's click
 *  handling) and returns its lessons. If reading the result fails outright
 *  (most likely because the click caused a real navigation that destroyed
 *  the content script mid-request), falls back to waiting for the
 *  navigation to finish and asking whatever fresh content script now exists. */
async function scanOneModule(tabId: number, rootUrl: string, cardIndex: number): Promise<RawLesson[]> {
  await navigateTab(tabId, rootUrl);
  await waitForTabComplete(tabId).catch(() => undefined);

  const position = await sendToTab<{ type: "MODULE_ENTRY_POSITION_RESULT"; x: number; y: number }>(
    tabId,
    { type: "GET_MODULE_ENTRY_POSITION", index: cardIndex }
  );
  await dispatchTrustedClick(tabId, position.x, position.y);

  try {
    const lessons = await requestVisibleLessons(tabId, 20000);
    if (lessons.length > 0) return lessons;
  } catch {
    // fall through to the hard-navigation recovery path below
  }

  await waitForTabComplete(tabId, 8000).catch(() => undefined);
  return requestVisibleLessons(tabId).catch(() => []);
}

async function requestVisibleLessons(tabId: number, timeoutMs = 30000): Promise<RawLesson[]> {
  const res = await sendToTab<{ type: "VISIBLE_LESSONS_RESULT"; lessons: RawLesson[] }>(
    tabId,
    { type: "SCAN_VISIBLE_LESSONS_REQUEST" },
    timeoutMs
  );
  return res.lessons;
}

function buildModuleSummary(moduleTitle: string, rawLessons: RawLesson[], order: number): ModuleSummary {
  const moduleId = `module_${order}_${slugify(moduleTitle)}`;
  const lessons: LessonMeta[] = rawLessons.map((lesson, index) => ({
    id: idFromUrl(lesson.url),
    title: lesson.title,
    url: lesson.url,
    moduleId,
    moduleTitle,
    order: index
  }));
  return { id: moduleId, title: moduleTitle, order, lessons };
}
