import { downloadLessonResources } from "@/download/resourceDownloader";
import { saveBlobToDownloads } from "@/download/downloader";
import { buildCourseArchive } from "@/exporters/zipPackager";
import { cacheLesson, getCachedLesson } from "@/storage/lessonCache";
import { saveJob } from "@/storage/jobStore";
import type {
  ArchiveJobState,
  ArchiveSettings,
  CourseSummary,
  ExtractedLesson,
  LessonMeta
} from "@/types";
import { generateJobId } from "@/utils/id";
import { logger } from "@/utils/logger";
import { sanitizePathSegment } from "@/utils/sanitize";
import { estimateRemainingMs } from "@/utils/time";
import { broadcastMessage, navigateTab, sendToTab, waitForTabComplete } from "./tabMessaging";

const MAX_ATTEMPTS = 3;

export class ArchivePipeline {
  private cancelled = false;
  readonly job: ArchiveJobState;

  constructor(
    private readonly course: CourseSummary,
    private readonly tabId: number,
    private readonly settings: ArchiveSettings,
    existingJob?: ArchiveJobState
  ) {
    const lessons = course.modules.flatMap((m) => m.lessons);
    this.job =
      existingJob ??
      ({
        id: generateJobId(),
        courseId: course.id,
        courseTitle: course.title,
        course,
        phase: "extracting",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        totalLessons: lessons.length,
        startTime: Date.now(),
        lessons: Object.fromEntries(
          lessons.map((l) => [l.id, { lessonId: l.id, status: "pending" as const, attempts: 0 }])
        ),
        logs: []
      } satisfies ArchiveJobState);
  }

  cancel(): void {
    this.cancelled = true;
  }

  private async persist(): Promise<void> {
    this.job.updatedAt = Date.now();
    await saveJob(this.job);
    broadcastMessage({ type: "JOB_STATE_UPDATE", job: this.job });
  }

  private log(level: "info" | "warn" | "error", message: string): void {
    const entry = logger[level](message);
    this.job.logs.push(entry);
    if (this.job.logs.length > 500) this.job.logs.shift();
  }

  async run(): Promise<Blob | null> {
    const allLessons = this.course.modules.flatMap((m) => m.lessons);
    const extracted: ExtractedLesson[] = [];

    for (const meta of allLessons) {
      if (this.cancelled) break;

      const state = this.job.lessons[meta.id]!;
      if (state.status === "completed") {
        const cached = await getCachedLesson(this.job.id, meta.id);
        if (cached) {
          extracted.push(cached);
          continue;
        }
        state.status = "pending";
      }
      if (state.status === "skipped") continue;

      const completedCount = allLessons.filter((l) => this.job.lessons[l.id]!.status === "completed")
        .length;
      this.job.estimatedRemainingMs = estimateRemainingMs(
        this.job.startTime,
        completedCount,
        allLessons.length
      );

      const lesson = await this.processLesson(meta);
      if (lesson) extracted.push(lesson);
      await this.persist();
    }

    if (extracted.length === 0) {
      this.job.phase = this.cancelled ? "idle" : "error";
      await this.persist();
      return null;
    }

    if (this.cancelled) {
      this.log("warn", `Cancelled — packaging the ${extracted.length} lesson(s) already extracted.`);
    }

    this.job.phase = "packaging";
    // Leftover from the last extraction step otherwise — nothing updates it
    // during packaging, so it'd sit there looking stale/stuck (e.g. "~1s
    // left") for however long packaging actually takes.
    this.job.estimatedRemainingMs = undefined;
    await this.persist();

    const zipBlob = await buildCourseArchive(this.job.id, this.course, extracted, this.settings, {
      onLessonPackaged: (lessonId) => {
        this.log("info", `Packaged ${lessonId}`);
        // Not awaited — packaging must not pause on it — but persisting here
        // both gives the popup visible progress during what can otherwise
        // look like a long stall, and the extra chrome.storage/runtime
        // activity helps keep the service worker alive through a long zip.
        void this.persist();
      }
    });

    await saveBlobToDownloads(zipBlob, `${sanitizePathSegment(this.course.title)}.zip`);

    this.job.phase = "done";
    await this.persist();
    return zipBlob;
  }

  private async processLesson(meta: LessonMeta): Promise<ExtractedLesson | null> {
    const state = this.job.lessons[meta.id]!;
    state.status = "in_progress";
    await this.persist();

    while (state.attempts < MAX_ATTEMPTS) {
      state.attempts++;
      try {
        const lesson = await this.extractAndDownload(meta);
        state.status = "completed";
        state.error = undefined;
        await cacheLesson(this.job.id, lesson);
        this.log("info", `Extracted "${lesson.title}"`);
        return lesson;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        state.error = message;
        this.log("warn", `Attempt ${state.attempts} failed for "${meta.title}": ${message}`);
      }
    }

    state.status = "failed";
    this.log("error", `Giving up on "${meta.title}" after ${MAX_ATTEMPTS} attempts — skipping.`);
    return null;
  }

  private async extractAndDownload(meta: LessonMeta): Promise<ExtractedLesson> {
    await navigateTab(this.tabId, meta.url);
    await waitForTabComplete(this.tabId);

    const response = await sendToTab<{ type: "EXTRACT_LESSON_RESULT"; lesson: ExtractedLesson }>(
      this.tabId,
      { type: "EXTRACT_LESSON_REQUEST", lesson: meta }
    );
    const lesson = response.lesson;

    const resolved = await downloadLessonResources(
      this.job.id,
      lesson.id,
      { images: lesson.images, videos: lesson.videos, attachments: lesson.attachments },
      {
        downloadImages: this.settings.downloadImages,
        downloadVideos: this.settings.downloadVideos,
        maxParallel: this.settings.maxParallelDownloads
      }
    );

    return { ...lesson, ...resolved };
  }
}
