import type { AttachmentRef, ImageRef, VideoRef } from "@/types";
import { cacheFile, getCachedFile } from "@/storage/lessonCache";
import { mapWithConcurrency } from "@/utils/concurrency";
import { sanitizePathSegment } from "@/utils/sanitize";
import { logger } from "@/utils/logger";
import { fetchAsBlob } from "./fetcher";

export interface DownloadedResource {
  localPath: string;
  blob: Blob;
}

/** Downloads all image/video/attachment resources for a lesson into blobs
 *  for zip packaging, skipping anything already cached from a prior
 *  (interrupted) run of the same job. DRM-protected videos are never
 *  fetched — they're left for the report instead. */
export async function downloadLessonResources(
  jobId: string,
  lessonId: string,
  resources: { images: ImageRef[]; videos: VideoRef[]; attachments: AttachmentRef[] },
  options: { downloadImages: boolean; downloadVideos: boolean; maxParallel: number }
): Promise<{ images: ImageRef[]; videos: VideoRef[]; attachments: AttachmentRef[] }> {
  const images = options.downloadImages
    ? await mapWithConcurrency(resources.images, options.maxParallel, (image, index) =>
        downloadOne(
          jobId,
          lessonId,
          "image",
          `${lessonId}-image-${index}${extOf(image.originalUrl)}`,
          image.originalUrl
        ).then((localPath) => ({ ...image, localPath }))
      )
    : resources.images;

  const downloadableVideos = resources.videos.filter((v) => !v.protected && v.sourceUrl);
  const videoResults = options.downloadVideos
    ? await mapWithConcurrency(downloadableVideos, options.maxParallel, (video, index) =>
        downloadOne(
          jobId,
          lessonId,
          "video",
          `${lessonId}-video-${index}${extOf(video.sourceUrl!)}`,
          video.sourceUrl!
        )
          .then((localPath) => ({ ...video, localPath: undefined, embedUrl: video.embedUrl, sourceUrl: localPath }))
          .catch((error: unknown) => {
            logger.warn(`Video download failed for lesson ${lessonId}: ${String(error)}`);
            return { ...video, protected: true, reason: "Download failed after retries." };
          })
      )
    : [];
  const videos = resources.videos.map((v) => {
    if (v.protected || !v.sourceUrl) return v;
    return videoResults.find((r) => r.sourceUrl === v.sourceUrl || r.embedUrl === v.embedUrl) ?? v;
  });

  const attachments = await mapWithConcurrency(resources.attachments, options.maxParallel, (attachment) =>
    downloadOne(
      jobId,
      lessonId,
      "attachment",
      `${lessonId}-${sanitizePathSegment(attachment.name)}`,
      attachment.url
    )
      .then((localPath) => ({ ...attachment, localPath }))
      .catch((error: unknown) => {
        logger.warn(`Attachment download failed (${attachment.name}): ${String(error)}`);
        return attachment;
      })
  );

  return { images, videos, attachments };
}

async function downloadOne(
  jobId: string,
  lessonId: string,
  kind: "image" | "video" | "attachment",
  name: string,
  url: string
): Promise<string> {
  const cached = await getCachedFile(jobId, lessonId, kind, name);
  const localPath = `${kind}s/${name}`;
  if (cached) return localPath;

  const blob = await fetchAsBlob(url);
  await cacheFile(jobId, lessonId, kind, name, blob);
  return localPath;
}

function extOf(url: string): string {
  const match = url.split("?")[0]?.match(/\.[a-zA-Z0-9]{2,5}$/);
  return match?.[0] ?? "";
}
