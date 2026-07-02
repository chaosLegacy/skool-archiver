import type { ContentBlock, ExtractedLesson } from "@/types";

/** Returns a copy of the lesson with all `localPath` resource references
 *  rewritten relative to a given file depth (e.g. HTML/MD files live two
 *  directories below the course root, under Modules/<Module>/). */
export function withRelativeImagePaths(lesson: ExtractedLesson, prefix: string): ExtractedLesson {
  const rewrite = (path?: string): string | undefined => (path ? `${prefix}${path}` : path);

  const blocks: ContentBlock[] = lesson.blocks.map((block) => {
    if (block.type === "image") {
      return { ...block, ref: { ...block.ref, localPath: rewrite(block.ref.localPath) } };
    }
    if (block.type === "video") {
      const sourceUrl = block.ref.sourceUrl?.startsWith("videos/")
        ? rewrite(block.ref.sourceUrl)
        : block.ref.sourceUrl;
      const thumbnailLocalPath = rewrite(block.ref.thumbnailLocalPath);
      return { ...block, ref: { ...block.ref, sourceUrl, thumbnailLocalPath } };
    }
    return block;
  });

  return {
    ...lesson,
    blocks,
    images: lesson.images.map((img) => ({ ...img, localPath: rewrite(img.localPath) })),
    attachments: lesson.attachments.map((a) => ({ ...a, localPath: rewrite(a.localPath) }))
  };
}
