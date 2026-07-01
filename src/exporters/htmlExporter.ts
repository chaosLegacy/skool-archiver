import type { ContentBlock, ExtractedLesson } from "@/types";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderBlock(block: ContentBlock): string {
  switch (block.type) {
    case "heading":
      return `<h${block.level}>${escapeHtml(block.text)}</h${block.level}>`;
    case "paragraph":
      return `<p>${escapeHtml(block.text)}</p>`;
    case "list": {
      const tag = block.ordered ? "ol" : "ul";
      const items = block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("\n");
      return `<${tag}>\n${items}\n</${tag}>`;
    }
    case "table": {
      const head = block.ref.headers.length
        ? `<thead><tr>${block.ref.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>`
        : "";
      const body = block.ref.rows
        .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
        .join("\n");
      return `<table>${head}<tbody>${body}</tbody></table>`;
    }
    case "code":
      return `<pre><code class="language-${block.ref.language ?? ""}">${escapeHtml(
        block.ref.code
      )}</code></pre>`;
    case "quote":
      return `<blockquote><p>${escapeHtml(block.ref.text)}</p>${
        block.ref.author ? `<footer>${escapeHtml(block.ref.author)}</footer>` : ""
      }</blockquote>`;
    case "image":
      return `<figure><img src="${escapeHtml(block.ref.localPath ?? block.ref.originalUrl)}" alt="${escapeHtml(
        block.ref.alt ?? ""
      )}" />${block.ref.alt ? `<figcaption>${escapeHtml(block.ref.alt)}</figcaption>` : ""}</figure>`;
    case "video":
      if (block.ref.protected) {
        return `<p class="video-unavailable">Video not included: ${escapeHtml(
          block.ref.reason ?? "protected stream"
        )}</p>`;
      }
      return `<video controls src="${escapeHtml(block.ref.sourceUrl ?? "")}"></video>`;
    default:
      return "";
  }
}

export function exportLessonToHtml(lesson: ExtractedLesson): string {
  const body = lesson.blocks.map(renderBlock).join("\n");
  const links = lesson.links.length
    ? `<h3>Links</h3><ul>${lesson.links
        .map((l) => `<li><a href="${escapeHtml(l.href)}">${escapeHtml(l.text)}</a></li>`)
        .join("")}</ul>`
    : "";
  const attachments = lesson.attachments.length
    ? `<h3>Attachments</h3><ul>${lesson.attachments
        .map((a) => `<li><a href="${escapeHtml(a.localPath ?? a.url)}">${escapeHtml(a.name)}</a></li>`)
        .join("")}</ul>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(lesson.title)}</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 760px; margin: 40px auto; padding: 0 20px; color: #1a1a1e; line-height: 1.6; }
  .module-label { color: #6b6b70; text-transform: uppercase; font-size: 12px; font-weight: 600; letter-spacing: 0.04em; }
  h1 { margin-top: 4px; }
  img, video { max-width: 100%; border-radius: 6px; }
  pre { background: #f2f2f4; padding: 12px 14px; border-radius: 6px; overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; margin: 16px 0; }
  th, td { border: 1px solid #ddd; padding: 8px 10px; text-align: left; }
  blockquote { border-left: 3px solid #ddd; margin: 16px 0; padding: 4px 16px; color: #555; }
  .video-unavailable { color: #a33; font-style: italic; }
</style>
</head>
<body>
<div class="module-label">${escapeHtml(lesson.moduleTitle)}</div>
<h1>${escapeHtml(lesson.title)}</h1>
${lesson.subtitle ? `<p><em>${escapeHtml(lesson.subtitle)}</em></p>` : ""}
${body}
${links}
${attachments}
</body>
</html>`;
}
