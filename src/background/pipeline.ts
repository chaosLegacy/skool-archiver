import { downloadLessonResources } from "@/download/resourceDownloader";
import { cacheLesson, getCachedLesson } from "@/storage/lessonCache";
import { saveJob } from "@/storage/jobStore";
import type { ArchiveJobState, ArchiveSettings, CourseSummary, ExtractedLesson, LessonMeta } from "@/types";
import { generateJobId } from "@/utils/id";
import { logger } from "@/utils/logger";
import { estimateRemainingMs } from "@/utils/time";
import { broadcastMessage, navigateTab, sendToTab, waitForTabComplete } from "./tabMessaging";

const MAX_ATTEMPTS = 3;

/** Drives scan → per-lesson extract → resource download → cache for the
 *  whole course, and stops at the "extracted" phase. It deliberately does
 *  NOT zip or download anything — that's a separate, user-triggered step
 *  (see background/packaging.ts) so the same extraction can be packaged as
 *  "everything" or "just this classroom" (possibly more than once) without
 *  re-extracting. */
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

  async run(): Promise<void> {
    const allLessons = this.course.modules.flatMap((m) => m.lessons);
    let completedCount = 0;

    for (const meta of allLessons) {
      if (this.cancelled) break;

      const state = this.job.lessons[meta.id]!;
      if (state.status === "completed") {
        const cached = await getCachedLesson(this.job.id, meta.id);
        if (cached) {
          completedCount++;
          continue;
        }
        state.status = "pending";
      }
      if (state.status === "skipped") continue;

      this.job.estimatedRemainingMs = estimateRemainingMs(
        this.job.startTime,
        completedCount,
        allLessons.length
      );

      const lesson = await this.processLesson(meta);
      if (lesson) completedCount++;
      await this.persist();
    }

    if (completedCount === 0) {
      this.job.phase = this.cancelled ? "idle" : "error";
      await this.persist();
      return;
    }

    if (this.cancelled) {
      this.log("warn", `Cancelled — ${completedCount} lesson(s) already extracted are ready to download.`);
    }

    this.job.phase = "extracted";
    this.job.estimatedRemainingMs = undefined;
    await this.persist();
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
