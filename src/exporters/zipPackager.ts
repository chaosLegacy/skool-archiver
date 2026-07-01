import JSZip from "jszip";
import type { ArchiveMetadata, ArchiveSettings, CourseSummary, ExtractedLesson } from "@/types";
import { getCachedFile } from "@/storage/lessonCache";
import { formatFilename, sanitizePathSegment } from "@/utils/sanitize";
import { exportLessonToHtml } from "./htmlExporter";
import { exportLessonToJson } from "./jsonExporter";
import { exportLessonToMarkdown } from "./markdownExporter";
import { exportLessonToPdf, type ImageAsset } from "./pdfExporter";
import { withRelativeImagePaths } from "./relativePaths";

const PACKAGE_VERSION = "0.1.0";

export interface PackagingProgress {
  onLessonPackaged?(lessonId: string): void;
}

/** Builds `Course Name.zip` with the structure:
 *  Course Name/Modules/<Module>/<Lesson>.{pdf,html,md,json}, images/, videos/,
 *  manifest.json, metadata.json — matching the required export layout. */
export async function buildCourseArchive(
  jobId: string,
  course: CourseSummary,
  lessons: ExtractedLesson[],
  settings: ArchiveSettings,
  progress: PackagingProgress = {}
): Promise<Blob> {
  const zip = new JSZip();
  const courseFolderName = sanitizePathSegment(course.title);
  const root = zip.folder(courseFolderName)!;
  const modulesFolder = root.folder("Modules")!;
  const imagesFolder = root.folder("images")!;
  const videosFolder = root.folder("videos")!;

  let imageCount = 0;
  let videoCount = 0;
  let pdfCount = 0;

  for (const lesson of lessons) {
    const moduleFolder = modulesFolder.folder(sanitizePathSegment(lesson.moduleTitle))!;
    const filename = formatFilename(settings.filenameFormat, {
      order: lesson.order + 1,
      title: lesson.title
    });

    for (const image of lesson.images) {
      if (!image.localPath) continue;
      const name = image.localPath.split("/").pop()!;
      const blob = await getCachedFile(jobId, lesson.id, "image", name);
      if (blob) {
        imagesFolder.file(name, blob);
        imageCount++;
      }
    }

    for (const video of lesson.videos) {
      if (video.protected || !video.sourceUrl?.startsWith("videos/")) continue;
      const name = video.sourceUrl.split("/").pop()!;
      const blob = await getCachedFile(jobId, lesson.id, "video", name);
      if (blob) {
        videosFolder.file(name, blob);
        videoCount++;
      }
    }

    for (const attachment of lesson.attachments) {
      if (!attachment.localPath) continue;
      const name = attachment.localPath.split("/").pop()!;
      const blob = await getCachedFile(jobId, lesson.id, "attachment", name);
      if (blob) moduleFolder.file(name, blob);
    }

    const relativeLesson = withRelativeImagePaths(lesson, "../../");

    if (settings.exportFormats.pdf) {
      const imageAssets = await buildImageAssetMap(jobId, lesson);
      const pdfBlob = await exportLessonToPdf(lesson, imageAssets);
      moduleFolder.file(`${filename}.pdf`, pdfBlob);
      pdfCount++;
    }
    if (settings.exportFormats.html) {
      moduleFolder.file(`${filename}.html`, exportLessonToHtml(relativeLesson));
    }
    if (settings.exportFormats.markdown) {
      moduleFolder.file(`${filename}.md`, exportLessonToMarkdown(relativeLesson));
    }
    if (settings.exportFormats.json) {
      moduleFolder.file(`${filename}.json`, exportLessonToJson(lesson));
    }

    progress.onLessonPackaged?.(lesson.id);
  }

  const metadata: ArchiveMetadata = {
    courseTitle: course.title,
    exportDate: new Date().toISOString(),
    moduleCount: course.modules.length,
    lessonCount: lessons.length,
    imageCount,
    videoCount,
    pdfCount,
    version: PACKAGE_VERSION
  };
  root.file("metadata.json", JSON.stringify(metadata, null, 2));
  root.file(
    "manifest.json",
    JSON.stringify(
      {
        course,
        lessons: lessons.map((l) => ({ id: l.id, title: l.title, moduleId: l.moduleId, order: l.order }))
      },
      null,
      2
    )
  );

  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

async function buildImageAssetMap(
  jobId: string,
  lesson: ExtractedLesson
): Promise<Map<string, ImageAsset>> {
  const map = new Map<string, ImageAsset>();
  for (const image of lesson.images) {
    if (!image.localPath) continue;
    const name = image.localPath.split("/").pop()!;
    const blob = await getCachedFile(jobId, lesson.id, "image", name);
    if (!blob) continue;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    map.set(image.originalUrl, { bytes, mimeType: blob.type || "image/png" });
  }
  return map;
}
