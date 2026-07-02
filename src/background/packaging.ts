import { saveBlobToDownloads } from "@/download/downloader";
import { buildCourseArchive } from "@/exporters/zipPackager";
import { getCachedLesson } from "@/storage/lessonCache";
import { getJob, saveJob } from "@/storage/jobStore";
import { getSettings } from "@/storage/settingsStore";
import type { ArchiveJobState, ExtractedLesson } from "@/types";
import { sanitizePathSegment } from "@/utils/sanitize";
import { broadcastMessage } from "./tabMessaging";

/**
 * Builds and downloads a zip from a job's already-cached lessons — a
 * separate, user-triggered step from extraction (see pipeline.ts), so the
 * same completed extraction can be packaged as "everything" or "just this
 * classroom" (possibly more than once) without re-extracting anything.
 */
export async function packageAndDownloadJob(jobId: string, moduleId?: string): Promise<void> {
  const job = await getJob(jobId);
  if (!job) throw new Error("That archive job could not be found.");

  const modules = moduleId ? job.course.modules.filter((m) => m.id === moduleId) : job.course.modules;
  if (moduleId && modules.length === 0) {
    throw new Error("That classroom could not be found — try scanning again.");
  }

  const lessonMetas = modules.flatMap((m) => m.lessons);
  const extracted: ExtractedLesson[] = [];
  for (const meta of lessonMetas) {
    const cached = await getCachedLesson(jobId, meta.id);
    if (cached) extracted.push(cached);
  }

  if (extracted.length === 0) {
    throw new Error("No extracted lessons were found to package for that selection.");
  }

  const settings = await getSettings();
  job.phase = "packaging";
  await persist(job);

  // JSZip's progress callback fires per file, which for a big archive can be
  // many times a second — throttle how often that turns into a
  // storage write + broadcast rather than persisting on every tick.
  let lastPersistedPercent = -10;
  const courseForZip = { ...job.course, modules };
  const zipBlob = await buildCourseArchive(jobId, courseForZip, extracted, settings, {
    onLessonPackaged: () => void persist(job),
    onZipProgress: (percent) => {
      if (percent - lastPersistedPercent < 5) return;
      lastPersistedPercent = percent;
      void persist(job);
    }
  });

  const zipName =
    moduleId && modules.length === 1
      ? `${sanitizePathSegment(job.course.title)} - ${sanitizePathSegment(modules[0]!.title)}.zip`
      : `${sanitizePathSegment(job.course.title)}.zip`;
  await saveBlobToDownloads(zipBlob, zipName);

  job.phase = "extracted"; // ready to package another selection from the same job
  await persist(job);
}

async function persist(job: ArchiveJobState): Promise<void> {
  job.updatedAt = Date.now();
  await saveJob(job);
  broadcastMessage({ type: "JOB_STATE_UPDATE", job });
}
