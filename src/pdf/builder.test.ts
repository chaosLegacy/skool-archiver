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
});
