import { describe, expect, it } from "vitest";
import type { ExtractedLesson } from "@/types";
import { exportLessonToHtml } from "./htmlExporter";

function makeLesson(overrides: Partial<ExtractedLesson> = {}): ExtractedLesson {
  return {
    id: "lesson-1",
    title: "Getting Started",
    url: "https://skool.com/c/lesson-1",
    moduleId: "module-1",
    moduleTitle: "Module 1",
    order: 0,
    blocks: [],
    images: [],
    videos: [],
    links: [],
    attachments: [],
    ...overrides
  };
}

describe("exportLessonToHtml", () => {
  it("renders the title, module label, and body blocks", () => {
    const html = exportLessonToHtml(
      makeLesson({ blocks: [{ type: "paragraph", text: "Hello world" }] })
    );
    expect(html).toContain("<h1>Getting Started</h1>");
    expect(html).toContain("Module 1");
    expect(html).toContain("<p>Hello world</p>");
  });

  it("shows the downloaded thumbnail and a watch link for a protected video", () => {
    const html = exportLessonToHtml(
      makeLesson({
        blocks: [
          {
            type: "video",
            ref: {
              provider: "youtube",
              protected: true,
              reason: "click-to-play thumbnail",
              title: "My Video",
              thumbnailLocalPath: "images/thumb.jpg",
              embedUrl: "https://www.youtube.com/watch?v=abc123"
            }
          }
        ]
      })
    );
    expect(html).toContain('<img src="images/thumb.jpg"');
    expect(html).toContain('href="https://www.youtube.com/watch?v=abc123"');
    expect(html).toContain("Video not included");
  });
});
