import type { CourseSummary, ExtractedLesson, LessonMeta } from "@/types";
import { waitForElement } from "@/utils/dom";
import { idFromUrl, slugify } from "@/utils/id";
import type { PlatformExtractor } from "../types";
import { extractCurrentLessonFromDom } from "./lessonExtractor";
import { isClassroomPage, isSkoolHost, scanVisibleLessons } from "./scanner";

export const skoolExtractor: PlatformExtractor = {
  id: "skool",
  matches: isSkoolHost,
  isClassroomPage: () => isClassroomPage(),
  /** Content-script-only fallback: scans whatever lesson links are already
   *  visible on the current page as a single module. Full multi-module
   *  discovery (clicking through hrefless module cards) is orchestrated by
   *  background/moduleScanner.ts instead, since that requires driving real
   *  page navigations. */
  async scanCourse(): Promise<CourseSummary | null> {
    const lessons = scanVisibleLessons();
    if (lessons.length === 0) return null;
    const url = window.location.href;
    const moduleId = `module_0_${slugify(document.title)}`;
    return {
      id: idFromUrl(url),
      title: document.title || "Untitled Course",
      url,
      modules: [
        {
          id: moduleId,
          title: document.title || "Module 1",
          order: 0,
          lessons: lessons.map((lesson, index) => ({
            id: idFromUrl(lesson.url),
            title: lesson.title,
            url: lesson.url,
            moduleId,
            moduleTitle: document.title || "Module 1",
            order: index
          }))
        }
      ]
    };
  },
  async extractCurrentLesson(meta: LessonMeta): Promise<ExtractedLesson> {
    await waitForElement('a[href*="?md="]', 8000);
    return extractCurrentLessonFromDom(meta);
  }
};

export { isClassroomPage, isSkoolHost } from "./scanner";
