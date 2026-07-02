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

  it("treats a plain div/span with its own text as a paragraph (Skool's post body pattern)", () => {
    document.body.innerHTML = `
      <div id="root">
        <div class="sc-957f0fec-13 gQNoKo">New video just went live. Check the prompt pack.</div>
        <div class="wrapper"><span class="sc-x">Nested span text</span></div>
      </div>
    `;
    const root = document.getElementById("root")!;
    const result = extractBody(root);
    expect(result.blocks).toEqual([
      { type: "paragraph", text: "New video just went live. Check the prompt pack." },
      { type: "paragraph", text: "Nested span text" }
    ]);
  });

  it("does not double-count a wrapper div whose text all comes from a handled child", () => {
    document.body.innerHTML = `
      <div id="root">
        <div class="wrapper"><h2>A Heading</h2></div>
      </div>
    `;
    const root = document.getElementById("root")!;
    const result = extractBody(root);
    expect(result.blocks).toEqual([{ type: "heading", level: 2, text: "A Heading" }]);
  });

  it("reports a YouTube thumbnail placeholder as a protected video instead of dropping it", () => {
    document.body.innerHTML = `
      <div id="root">
        <div alt="My Video Title" style='background-image: url("https://i.ytimg.com/vi/9-iSl83dF34/hqdefault.jpg");'></div>
      </div>
    `;
    const root = document.getElementById("root")!;
    const result = extractBody(root);
    expect(result.videos).toHaveLength(1);
    expect(result.videos[0]).toMatchObject({
      provider: "youtube",
      protected: true,
      embedUrl: "https://www.youtube.com/watch?v=9-iSl83dF34"
    });
    expect(result.blocks).toEqual([{ type: "video", ref: result.videos[0] }]);
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
