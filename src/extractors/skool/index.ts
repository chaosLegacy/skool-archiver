import type { ExtractedLesson, LessonMeta } from "@/types";
import { waitForElement } from "@/utils/dom";
import type { PlatformExtractor } from "../types";
import { extractCurrentLessonFromDom } from "./lessonExtractor";
import { isClassroomPage, isSkoolHost, scanCourseFromDom } from "./scanner";
import { SKOOL_SELECTORS } from "./selectors";

export const skoolExtractor: PlatformExtractor = {
  id: "skool",
  matches: isSkoolHost,
  isClassroomPage: () => isClassroomPage(),
  async scanCourse() {
    await waitForElement(SKOOL_SELECTORS.moduleGroup[0]!, 5000);
    return scanCourseFromDom();
  },
  async extractCurrentLesson(meta: LessonMeta): Promise<ExtractedLesson> {
    await waitForElement(SKOOL_SELECTORS.lessonContentRoot[0]!, 8000);
    return extractCurrentLessonFromDom(meta);
  }
};

export { isClassroomPage, isSkoolHost } from "./scanner";
