import type { ExtractedLesson } from "@/types";
import { idbDeletePrefix, idbGet, idbSet, STORES } from "./db";

function lessonKey(jobId: string, lessonId: string): string {
  return `${jobId}:${lessonId}`;
}

function fileKey(jobId: string, lessonId: string, kind: string, name: string): string {
  return `${jobId}:${lessonId}:${kind}:${name}`;
}

export async function cacheLesson(jobId: string, lesson: ExtractedLesson): Promise<void> {
  await idbSet(STORES.lessons, lessonKey(jobId, lesson.id), lesson);
}

export async function getCachedLesson(
  jobId: string,
  lessonId: string
): Promise<ExtractedLesson | undefined> {
  return idbGet<ExtractedLesson>(STORES.lessons, lessonKey(jobId, lessonId));
}

export async function cacheFile(
  jobId: string,
  lessonId: string,
  kind: "pdf" | "html" | "markdown" | "json" | "image" | "video" | "attachment",
  name: string,
  blob: Blob
): Promise<void> {
  await idbSet(STORES.files, fileKey(jobId, lessonId, kind, name), blob);
}

export async function getCachedFile(
  jobId: string,
  lessonId: string,
  kind: string,
  name: string
): Promise<Blob | undefined> {
  return idbGet<Blob>(STORES.files, fileKey(jobId, lessonId, kind, name));
}

export async function clearJobCache(jobId: string): Promise<void> {
  await idbDeletePrefix(STORES.lessons, `${jobId}:`);
  await idbDeletePrefix(STORES.files, `${jobId}:`);
}
