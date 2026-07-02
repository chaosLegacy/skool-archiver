import { describe, expect, it } from "vitest";
import type { ExtractedLesson } from "@/types";
import { exportLessonToMarkdown } from "./markdownExporter";

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

describe("exportLessonToMarkdown", () => {
  it("renders headings, paragraphs, and title metadata", () => {
    const md = exportLessonToMarkdown(
      makeLesson({
        blocks: [
          { type: "heading", level: 2, text: "Overview" },
          { type: "paragraph", text: "Welcome to the course." }
        ]
      })
    );
    expect(md).toContain("# Getting Started");
    expect(md).toContain("_Module 1_");
    expect(md).toContain("## Overview");
    expect(md).toContain("Welcome to the course.");
  });

  it("marks protected videos instead of linking a stream", () => {
    const md = exportLessonToMarkdown(
      makeLesson({
        blocks: [
          {
            type: "video",
            ref: { provider: "youtube", protected: true, reason: "protected player" }
          }
        ]
      })
    );
    expect(md).toContain("Video not included: protected player");
  });

  it("includes the downloaded thumbnail and a watch link for a protected video", () => {
    const md = exportLessonToMarkdown(
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
    expect(md).toContain("![My Video](images/thumb.jpg)");
    expect(md).toContain("[Watch: My Video](https://www.youtube.com/watch?v=abc123)");
  });

  it("lists links and attachments", () => {
    const md = exportLessonToMarkdown(
      makeLesson({
        links: [{ href: "https://example.com", text: "Example" }],
        attachments: [{ name: "slides.pdf", url: "https://example.com/slides.pdf" }]
      })
    );
    expect(md).toContain("[Example](https://example.com)");
    expect(md).toContain("[slides.pdf](https://example.com/slides.pdf)");
  });
});
