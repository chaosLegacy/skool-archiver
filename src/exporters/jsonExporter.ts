import type { ExtractedLesson } from "@/types";

export function exportLessonToJson(lesson: ExtractedLesson): string {
  return JSON.stringify(lesson, null, 2);
}
