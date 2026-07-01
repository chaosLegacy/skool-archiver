import type { ContentBlock, ExtractedLesson } from "@/types";
import { PdfBuilder } from "@/pdf/builder";

export interface ImageAsset {
  bytes: Uint8Array;
  mimeType: string;
}

/** Renders a single lesson to a PDF Blob. `imageAssets` maps an ImageRef's
 *  originalUrl to already-downloaded bytes so the PDF never re-fetches
 *  anything itself. */
export async function exportLessonToPdf(
  lesson: ExtractedLesson,
  imageAssets: Map<string, ImageAsset>
): Promise<Blob> {
  const builder = await PdfBuilder.create(lesson.moduleTitle);

  const metaParts = [lesson.author, lesson.publishDate].filter(Boolean) as string[];
  builder.addTitleBlock(lesson.title, lesson.moduleTitle, metaParts);
  if (lesson.subtitle) builder.addParagraph(lesson.subtitle);

  for (const block of lesson.blocks) {
    await renderBlock(builder, block, imageAssets);
  }

  if (lesson.links.length) {
    builder.addHeading("Links", 3);
    for (const link of lesson.links) {
      builder.addLink(link.text, link.href);
    }
  }

  if (lesson.attachments.length) {
    builder.addHeading("Attachments", 3);
    for (const attachment of lesson.attachments) {
      builder.addLink(attachment.name, attachment.url);
    }
  }

  const bytes = await builder.save(lesson.title);
  return new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
}

async function renderBlock(
  builder: PdfBuilder,
  block: ContentBlock,
  imageAssets: Map<string, ImageAsset>
): Promise<void> {
  switch (block.type) {
    case "heading":
      builder.addHeading(block.text, block.level);
      break;
    case "paragraph":
      builder.addParagraph(block.text);
      break;
    case "list":
      builder.addList(block.items, block.ordered);
      break;
    case "table":
      builder.addTable(block.ref.headers, block.ref.rows);
      break;
    case "code":
      builder.addCodeBlock(block.ref.code, block.ref.language);
      break;
    case "quote":
      builder.addQuote(block.ref.text, block.ref.author);
      break;
    case "image": {
      const asset = imageAssets.get(block.ref.originalUrl);
      if (asset) await builder.addImage(asset.bytes, asset.mimeType, block.ref.alt);
      break;
    }
    case "video": {
      if (block.ref.protected) {
        builder.addParagraph(
          `[Video not included: ${block.ref.reason ?? "protected stream"}]`
        );
      } else if (block.ref.sourceUrl) {
        builder.addLink(`Video: ${block.ref.title ?? block.ref.provider}`, block.ref.sourceUrl);
      }
      break;
    }
  }
}
