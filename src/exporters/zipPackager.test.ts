import { describe, expect, it, vi } from "vitest";
import type { ArchiveSettings, CourseSummary, ExtractedLesson } from "@/types";
import { DEFAULT_SETTINGS } from "@/types";

const getCachedFileMock = vi.fn();
vi.mock("@/storage/lessonCache", () => ({
  getCachedFile: (...args: unknown[]) => getCachedFileMock(...args)
}));

const { buildCourseArchive } = await import("./zipPackager");

function makeLesson(overrides: Partial<ExtractedLesson> = {}): ExtractedLesson {
  return {
    id: "lesson-1",
    title: "Getting Started",
    url: "https://skool.com/c/lesson-1",
    moduleId: "module-1",
    moduleTitle: "Module 1",
    order: 0,
    blocks: [],
    images: [],
    videos: [],
    links: [],
    attachments: [],
    ...overrides
  };
}

const course: CourseSummary = {
  id: "course-1",
  title: "Test Course",
  url: "https://skool.com/g/classroom",
  modules: [{ id: "module-1", title: "Module 1", order: 0, lessons: [] }]
};

const settings: ArchiveSettings = { ...DEFAULT_SETTINGS, exportFormats: { pdf: false, html: false, markdown: false, json: true } };

describe("buildCourseArchive", () => {
  it("skips a file that fails to load from cache (e.g. an IndexedDB timeout) instead of aborting the whole archive", async () => {
    getCachedFileMock.mockRejectedValueOnce(new Error("IndexedDB get(files) timed out after 15000ms"));

    const lesson = makeLesson({
      images: [{ originalUrl: "https://cdn.example.com/pic.png", localPath: "images/lesson-1-image-0.png" }]
    });

    const warnings: string[] = [];
    const blob = await buildCourseArchive("job-1", course, [lesson], settings, {
      onWarning: (message) => warnings.push(message)
    });

    expect(blob).toBeInstanceOf(Blob);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("timed out");
  });

  it("still packages fine when every cache read succeeds", async () => {
    getCachedFileMock.mockResolvedValue(new Blob(["x"]));

    const lesson = makeLesson();
    const blob = await buildCourseArchive("job-1", course, [lesson], settings, {});
    expect(blob).toBeInstanceOf(Blob);
  });
});
