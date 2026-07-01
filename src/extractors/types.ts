import type { CourseSummary, ExtractedLesson, LessonMeta } from "@/types";

/**
 * Contract every LMS-specific extractor package must satisfy. New platforms are
 * supported by adding a module here and registering it in extractors/index.ts —
 * the core pipeline never needs to change.
 */
export interface PlatformExtractor {
  id: string;
  /** Returns true if the current page belongs to this platform. */
  matches(url: string): boolean;
  /** Returns true if the current page is a scannable classroom/course page. */
  isClassroomPage(): boolean;
  /** Walks the classroom UI (sidebar/module list) to build the module/lesson tree. */
  scanCourse(): Promise<CourseSummary | null>;
  /** Navigates to and extracts full content for a single lesson. Assumes the
   *  current document IS the lesson page (navigation is handled by the caller). */
  extractCurrentLesson(meta: LessonMeta): Promise<ExtractedLesson>;
}
