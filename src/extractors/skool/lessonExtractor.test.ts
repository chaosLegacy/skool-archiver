import { describe, expect, it } from "vitest";
import type { LessonMeta } from "@/types";
import { extractCurrentLessonFromDom } from "./lessonExtractor";

const meta: LessonMeta = {
  id: "lesson-1",
  title: "fallback title",
  url: "https://www.skool.com/nextgenai/classroom/34bba8b6?md=345b9b3548734b6d9f8820fe31d27761",
  moduleId: "module-1",
  moduleTitle: "Youtube Resources",
  order: 0
};

describe("extractCurrentLessonFromDom", () => {
  it("finds the lesson title, author, and body next to the ?md= link list", () => {
    document.body.innerHTML = `
      <div id="list">
        <a href="/nextgenai/classroom/34bba8b6?md=345b9b3548734b6d9f8820fe31d27761">Lesson A</a>
        <a href="/nextgenai/classroom/34bba8b6?md=949f1d0bbaa846a0af535aba4750e8ba">Lesson B</a>
      </div>
      <div id="content">
        <a href="/nextgenai/i-tried-ai-video-editing-for-8-days">
          <div>I Tried AI Video Editing for 8 Days</div>
        </a>
        <a href="/@dan-kieft-2499?g=nextgenai">
          <span title="Dan Kieft">Dan Kieft</span>
        </a>
        <p>New video just went live. This covers AI video editing tools.</p>
      </div>
    `;

    const lesson = extractCurrentLessonFromDom(meta);
    expect(lesson.title).toBe("I Tried AI Video Editing for 8 Days");
    expect(lesson.author).toBe("Dan Kieft");
    expect(lesson.blocks.some((b) => b.type === "paragraph")).toBe(true);
  });

  it("falls back to the given meta title when no content is found", () => {
    document.body.innerHTML = "<div>empty page</div>";
    const lesson = extractCurrentLessonFromDom(meta);
    expect(lesson.title).toBe("fallback title");
  });
});
