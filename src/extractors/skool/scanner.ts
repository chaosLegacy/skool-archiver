import type { CourseSummary, LessonMeta, ModuleSummary } from "@/types";
import { attrOf, textOf, toAbsoluteUrl } from "@/utils/dom";
import { idFromUrl, slugify } from "@/utils/id";
import { SKOOL_SELECTORS, querySelectorAllFirst, querySelectorFirst } from "./selectors";

export function isSkoolHost(url: string): boolean {
  return /(^|\.)skool\.com$/i.test(new URL(url).hostname);
}

export function isClassroomPage(url = window.location.href): boolean {
  return isSkoolHost(url) && /\/classroom(\/|$)/.test(new URL(url).pathname);
}

/** Walks the classroom sidebar/module list to build the full lesson tree.
 *  Runs entirely against the already-rendered DOM of the page the user is
 *  logged into — no navigation or additional requests are made here. */
export function scanCourseFromDom(): CourseSummary | null {
  const root = querySelectorFirst(document, SKOOL_SELECTORS.classroomRoot);
  if (!root) return null;

  const courseTitleEl = document.querySelector("h1");
  const courseTitle = textOf(courseTitleEl) || document.title || "Untitled Course";
  const courseUrl = window.location.href;

  const groups = querySelectorAllFirst(root, SKOOL_SELECTORS.moduleGroup);
  const modules: ModuleSummary[] = [];

  const groupSource = groups.length ? groups : [root];

  groupSource.forEach((group, groupIndex) => {
    const titleEl = querySelectorFirst(group, SKOOL_SELECTORS.moduleTitle);
    const moduleTitle = textOf(titleEl) || `Module ${groupIndex + 1}`;
    const moduleId = `module_${groupIndex}_${slugify(moduleTitle)}`;

    const lessonLinks = querySelectorAllFirst(group, SKOOL_SELECTORS.lessonLink) as HTMLAnchorElement[];
    const lessons: LessonMeta[] = lessonLinks
      .map((a, lessonIndex) => {
        const href = attrOf(a, "href");
        if (!href) return null;
        const url = toAbsoluteUrl(href);
        const title = textOf(a) || `Lesson ${lessonIndex + 1}`;
        const meta: LessonMeta = {
          id: idFromUrl(url),
          title,
          url,
          moduleId,
          moduleTitle,
          order: lessonIndex
        };
        return meta;
      })
      .filter((l): l is LessonMeta => l !== null);

    if (lessons.length > 0) {
      modules.push({ id: moduleId, title: moduleTitle, order: groupIndex, lessons });
    }
  });

  if (modules.length === 0) return null;

  return {
    id: idFromUrl(courseUrl.split("?")[0] ?? courseUrl),
    title: courseTitle,
    url: courseUrl,
    modules
  };
}
