import { PDFDocument, PDFFont, PDFName, PDFPage, StandardFonts, rgb, type RGB } from "pdf-lib";

const PAGE_WIDTH = 595.28; // A4 in points
const PAGE_HEIGHT = 841.89;
const MARGIN = 56;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_HEIGHT = 30;
const HEADER_HEIGHT = 24;

const COLORS = {
  text: rgb(0.12, 0.12, 0.14),
  muted: rgb(0.45, 0.45, 0.48),
  heading: rgb(0.05, 0.05, 0.08),
  link: rgb(0.11, 0.35, 0.85),
  codeBg: rgb(0.95, 0.95, 0.96),
  border: rgb(0.8, 0.8, 0.82)
};

interface PendingLink {
  page: PDFPage;
  x: number;
  y: number;
  width: number;
  height: number;
  url: string;
}

/**
 * Reusable PDF layout engine on top of pdf-lib. Handles automatic page
 * breaks, image scaling, syntax-tinted code blocks, clickable links, and
 * headers/footers — used by the PDF exporter for every lesson.
 */
export class PdfBuilder {
  private doc!: PDFDocument;
  private fontRegular!: PDFFont;
  private fontBold!: PDFFont;
  private fontMono!: PDFFont;
  private page!: PDFPage;
  private cursorY = 0;
  private headerText = "";
  private links: PendingLink[] = [];

  static async create(headerText: string): Promise<PdfBuilder> {
    const builder = new PdfBuilder();
    builder.doc = await PDFDocument.create();
    builder.fontRegular = await builder.doc.embedFont(StandardFonts.Helvetica);
    builder.fontBold = await builder.doc.embedFont(StandardFonts.HelveticaBold);
    builder.fontMono = await builder.doc.embedFont(StandardFonts.Courier);
    builder.headerText = headerText;
    builder.addPage();
    return builder;
  }

  private addPage(): void {
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.cursorY = PAGE_HEIGHT - MARGIN - HEADER_HEIGHT;
    if (this.headerText) {
      this.page.drawText(this.headerText, {
        x: MARGIN,
        y: PAGE_HEIGHT - MARGIN + 8,
        size: 9,
        font: this.fontRegular,
        color: COLORS.muted
      });
    }
  }

  private ensureSpace(height: number): void {
    if (this.cursorY - height < MARGIN + FOOTER_HEIGHT) {
      this.addPage();
    }
  }

  addTitleBlock(title: string, moduleTitle: string, meta: string[]): void {
    this.ensureSpace(90);
    this.page.drawText(moduleTitle.toUpperCase(), {
      x: MARGIN,
      y: this.cursorY,
      size: 10,
      font: this.fontBold,
      color: COLORS.muted
    });
    this.cursorY -= 26;
    this.wrapText(title, this.fontBold, 22, COLORS.heading);
    this.cursorY -= 6;
    if (meta.length) {
      this.page.drawText(meta.join("  ·  "), {
        x: MARGIN,
        y: this.cursorY,
        size: 9,
        font: this.fontRegular,
        color: COLORS.muted
      });
      this.cursorY -= 20;
    }
    this.drawRule();
  }

  addHeading(text: string, level: number): void {
    const size = level <= 1 ? 18 : level === 2 ? 15 : 12.5;
    this.ensureSpace(size + 16);
    this.cursorY -= 8;
    this.wrapText(text, this.fontBold, size, COLORS.heading);
    this.cursorY -= 4;
  }

  addParagraph(text: string): void {
    this.wrapText(text, this.fontRegular, 11, COLORS.text, { lineGap: 5 });
    this.cursorY -= 8;
  }

  addList(items: string[], ordered: boolean): void {
    items.forEach((item, index) => {
      const bullet = ordered ? `${index + 1}.` : "•";
      this.wrapText(`${bullet}  ${item}`, this.fontRegular, 11, COLORS.text, {
        lineGap: 4,
        indent: 14
      });
    });
    this.cursorY -= 6;
  }

  addQuote(text: string, author?: string): void {
    this.ensureSpace(30);
    const startY = this.cursorY;
    this.wrapText(text, this.fontRegular, 11, COLORS.muted, { indent: 16, italic: true });
    if (author) {
      this.wrapText(`— ${author}`, this.fontRegular, 9.5, COLORS.muted, { indent: 16 });
    }
    this.page.drawLine({
      start: { x: MARGIN, y: startY + 12 },
      end: { x: MARGIN, y: this.cursorY + 4 },
      thickness: 2,
      color: COLORS.border
    });
    this.cursorY -= 8;
  }

  addCodeBlock(code: string, language?: string): void {
    const lines = code.split("\n");
    const lineHeight = 12;
    const padding = 8;
    const blockHeight = lines.length * lineHeight + padding * 2;
    this.ensureSpace(Math.min(blockHeight, PAGE_HEIGHT));

    if (language) {
      this.page.drawText(language, { x: MARGIN, y: this.cursorY, size: 8, font: this.fontRegular, color: COLORS.muted });
      this.cursorY -= 12;
    }

    let remaining = lines.slice();
    while (remaining.length) {
      const maxLinesOnPage = Math.floor((this.cursorY - MARGIN - FOOTER_HEIGHT - padding * 2) / lineHeight);
      const chunk = remaining.slice(0, Math.max(1, maxLinesOnPage));
      remaining = remaining.slice(chunk.length);
      const chunkHeight = chunk.length * lineHeight + padding * 2;

      this.page.drawRectangle({
        x: MARGIN,
        y: this.cursorY - chunkHeight,
        width: CONTENT_WIDTH,
        height: chunkHeight,
        color: COLORS.codeBg
      });
      let y = this.cursorY - padding - 9;
      for (const line of chunk) {
        this.page.drawText(line.slice(0, 110), {
          x: MARGIN + padding,
          y,
          size: 9,
          font: this.fontMono,
          color: COLORS.text
        });
        y -= lineHeight;
      }
      this.cursorY -= chunkHeight;
      if (remaining.length) this.addPage();
    }
    this.cursorY -= 10;
  }

  addTable(headers: string[], rows: string[][]): void {
    const columns = headers.length || rows[0]?.length || 1;
    const colWidth = CONTENT_WIDTH / columns;
    const rowHeight = 22;

    const drawRow = (cells: string[], bold: boolean, y: number): void => {
      cells.forEach((cell, i) => {
        this.page.drawText(truncateToWidth(cell, colWidth - 8, bold ? this.fontBold : this.fontRegular, 9.5), {
          x: MARGIN + i * colWidth + 4,
          y: y + 6,
          size: 9.5,
          font: bold ? this.fontBold : this.fontRegular,
          color: COLORS.text
        });
      });
      this.page.drawLine({
        start: { x: MARGIN, y },
        end: { x: MARGIN + CONTENT_WIDTH, y },
        thickness: 0.5,
        color: COLORS.border
      });
    };

    const allRows = headers.length ? [headers, ...rows] : rows;
    allRows.forEach((row, index) => {
      this.ensureSpace(rowHeight);
      this.cursorY -= rowHeight;
      drawRow(row, index === 0 && headers.length > 0, this.cursorY);
    });
    this.cursorY -= 10;
  }

  async addImage(bytes: Uint8Array, mimeType: string, caption?: string): Promise<void> {
    try {
      const image = mimeType.includes("png")
        ? await this.doc.embedPng(bytes)
        : await this.doc.embedJpg(bytes);
      const scale = Math.min(1, CONTENT_WIDTH / image.width);
      const width = image.width * scale;
      const height = image.height * scale;

      this.ensureSpace(height + (caption ? 16 : 0));
      this.cursorY -= height;
      this.page.drawImage(image, { x: MARGIN, y: this.cursorY, width, height });
      if (caption) {
        this.cursorY -= 12;
        this.page.drawText(caption, { x: MARGIN, y: this.cursorY, size: 8.5, font: this.fontRegular, color: COLORS.muted });
      }
      this.cursorY -= 10;
    } catch {
      this.addParagraph(caption ? `[Image unavailable: ${caption}]` : "[Image unavailable]");
    }
  }

  addLink(text: string, url: string): void {
    this.ensureSpace(18);
    const width = this.fontRegular.widthOfTextAtSize(text, 10.5);
    this.page.drawText(text, { x: MARGIN, y: this.cursorY, size: 10.5, font: this.fontRegular, color: COLORS.link });
    this.links.push({ page: this.page, x: MARGIN, y: this.cursorY, width, height: 12, url });
    this.cursorY -= 16;
  }

  private drawRule(): void {
    this.page.drawLine({
      start: { x: MARGIN, y: this.cursorY },
      end: { x: MARGIN + CONTENT_WIDTH, y: this.cursorY },
      thickness: 1,
      color: COLORS.border
    });
    this.cursorY -= 16;
  }

  private wrapText(
    text: string,
    font: PDFFont,
    size: number,
    color: RGB,
    opts: { lineGap?: number; indent?: number; italic?: boolean } = {}
  ): void {
    const indent = opts.indent ?? 0;
    const maxWidth = CONTENT_WIDTH - indent;
    const words = text.split(/\s+/).filter(Boolean);
    let line = "";

    const flush = (): void => {
      if (!line) return;
      this.ensureSpace(size + (opts.lineGap ?? 4));
      this.cursorY -= size;
      this.page.drawText(line, { x: MARGIN + indent, y: this.cursorY, size, font, color });
      this.cursorY -= opts.lineGap ?? 4;
      line = "";
    };

    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
        flush();
        line = word;
      } else {
        line = candidate;
      }
    }
    flush();
  }

  async save(footerLabel: string): Promise<Uint8Array> {
    const pages = this.doc.getPages();
    pages.forEach((page, index) => {
      page.drawText(`${footerLabel} — Page ${index + 1} of ${pages.length}`, {
        x: MARGIN,
        y: MARGIN - 24,
        size: 8,
        font: this.fontRegular,
        color: COLORS.muted
      });
    });

    for (const link of this.links) {
      const pageIndex = pages.indexOf(link.page);
      if (pageIndex === -1) continue;
      addLinkAnnotation(this.doc, link.page, link.x, link.y, link.width, link.height, link.url);
    }

    return this.doc.save();
  }
}

function truncateToWidth(text: string, maxWidth: number, font: PDFFont, size: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 1 && font.widthOfTextAtSize(`${truncated}…`, size) > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return `${truncated}…`;
}

function addLinkAnnotation(
  doc: PDFDocument,
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
  url: string
): void {
  const linkAnnotation = doc.context.register(
    doc.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: [x, y - 2, x + width, y + height],
      Border: [0, 0, 0],
      A: {
        Type: "Action",
        S: "URI",
        URI: url
      }
    })
  );
  const existingAnnots = page.node.Annots();
  if (existingAnnots) {
    existingAnnots.push(linkAnnotation);
  } else {
    page.node.set(PDFName.of("Annots"), doc.context.obj([linkAnnotation]));
  }
}
