import { describe, expect, it } from "vitest";
import { extractBody } from "./body";

describe("extractBody", () => {
  it("walks headings, paragraphs, images, and links in document order", () => {
    document.body.innerHTML = `
      <div id="root">
        <h2>Introduction</h2>
        <p>Hello <a href="https://example.com">world</a></p>
        <img src="https://cdn.example.com/pic.png" alt="A picture" />
        <ul><li>One</li><li>Two</li></ul>
      </div>
    `;
    const root = document.getElementById("root")!;
    const result = extractBody(root);

    expect(result.blocks.map((b) => b.type)).toEqual(["heading", "paragraph", "image", "list"]);
    expect(result.images).toHaveLength(1);
    expect(result.images[0]!.originalUrl).toBe("https://cdn.example.com/pic.png");
    expect(result.links).toHaveLength(1);
    expect(result.links[0]!.href).toBe("https://example.com/");
  });

  it("skips data-URI images and javascript: links", () => {
    document.body.innerHTML = `
      <div id="root">
        <img src="data:image/png;base64,xyz" />
        <a href="javascript:void(0)">no-op</a>
      </div>
    `;
    const root = document.getElementById("root")!;
    const result = extractBody(root);
    expect(result.images).toHaveLength(0);
    expect(result.links).toHaveLength(0);
  });
});
