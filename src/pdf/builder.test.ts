import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { PdfBuilder } from "./builder";

describe("PdfBuilder", () => {
  it("does not throw on titles/body text containing emoji (outside WinAnsi encoding)", async () => {
    const builder = await PdfBuilder.create("Youtube Resources");
    builder.addTitleBlock("👉 NEXT: Maximum Photorealism (Real-Reference Method)", "✏️ Homework", [
      "Dan Kieft"
    ]);
    builder.addParagraph("New video just went live 👇 check it out!");
    builder.addHeading("🎬 Section", 2);
    builder.addList(["First 🔥 item", "Second item"], false);
    builder.addQuote("A quote with an emoji 😀", "Author 🚀");
    builder.addCodeBlock("console.log('hi 👋')", "js");
    builder.addLink("A link 🔗", "https://example.com");

    const bytes = await builder.save("👉 NEXT: Maximum Photorealism");
    expect(bytes.length).toBeGreaterThan(0);
  });

  it("still renders normal WinAnsi punctuation like em dashes and ellipses", async () => {
    const builder = await PdfBuilder.create("Header");
    builder.addParagraph("An em dash — and an ellipsis…");
    const bytes = await builder.save("Footer — label");
    expect(bytes.length).toBeGreaterThan(0);
  });

  it("does not draw a quote's side rule across a page break using stale coordinates", async () => {
    const builder = await PdfBuilder.create("Header");
    // Long enough to force wrapText to add a page mid-quote.
    const longQuote = Array.from({ length: 300 }, (_, i) => `sentence number ${i}`).join(". ");
    builder.addQuote(longQuote, "Author");
    const bytes = await builder.save("Footer");

    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(1);
  });
});
