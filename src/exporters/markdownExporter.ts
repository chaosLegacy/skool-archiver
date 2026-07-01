import type { ContentBlock, ExtractedLesson } from "@/types";

function renderBlock(block: ContentBlock): string {
  switch (block.type) {
    case "heading":
      return `${"#".repeat(block.level)} ${block.text}`;
    case "paragraph":
      return block.text;
    case "list":
      return block.items
        .map((item, i) => (block.ordered ? `${i + 1}. ${item}` : `- ${item}`))
        .join("\n");
    case "table": {
      const header = block.ref.headers.length ? block.ref.headers : block.ref.rows[0] ?? [];
      const rows = block.ref.headers.length ? block.ref.rows : block.ref.rows.slice(1);
      const headerLine = `| ${header.join(" | ")} |`;
      const sepLine = `| ${header.map(() => "---").join(" | ")} |`;
      const rowLines = rows.map((row) => `| ${row.join(" | ")} |`);
      return [headerLine, sepLine, ...rowLines].join("\n");
    }
    case "code":
      return `\`\`\`${block.ref.language ?? ""}\n${block.ref.code}\n\`\`\``;
    case "quote": {
      const lines = block.ref.text.split("\n").map((line) => `> ${line}`);
      if (block.ref.author) lines.push(`> — ${block.ref.author}`);
      return lines.join("\n");
    }
    case "image":
      return `![${block.ref.alt ?? ""}](${block.ref.localPath ?? block.ref.originalUrl})`;
    case "video":
      return block.ref.protected
        ? `_Video not included: ${block.ref.reason ?? "protected stream"}_`
        : `[Video](${block.ref.sourceUrl ?? block.ref.embedUrl ?? ""})`;
    default:
      return "";
  }
}

export function exportLessonToMarkdown(lesson: ExtractedLesson): string {
  const parts = [`_${lesson.moduleTitle}_`, `# ${lesson.title}`];
  if (lesson.subtitle) parts.push(`*${lesson.subtitle}*`);
  parts.push(...lesson.blocks.map(renderBlock));

  if (lesson.links.length) {
    parts.push("## Links");
    parts.push(...lesson.links.map((l) => `- [${l.text}](${l.href})`));
  }
  if (lesson.attachments.length) {
    parts.push("## Attachments");
    parts.push(...lesson.attachments.map((a) => `- [${a.name}](${a.localPath ?? a.url})`));
  }

  return parts.join("\n\n");
}
