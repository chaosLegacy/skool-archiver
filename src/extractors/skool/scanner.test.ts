import { describe, expect, it } from "vitest";
import { clickModuleEntry, findModuleEntries, scanVisibleLessons } from "./scanner";

describe("findModuleEntries", () => {
  it("reads title text from click-only module cards (no href)", () => {
    document.body.innerHTML = `
      <div role="button" aria-roledescription="sortable" tabindex="0">
        <div class="sc-d25999f9-12">Youtube Resources</div>
        <div class="sc-d25999f9-13">Here you can find all the prompts and assets.</div>
        <div label="0% complete"><span>0%</span></div>
      </div>
      <div role="button" aria-roledescription="sortable" tabindex="0">
        <div>Q&amp;A with Dan</div>
        <div>All Q&amp;A recordings will be posted here.</div>
      </div>
    `;
    const entries = findModuleEntries();
    expect(entries).toEqual([
      { index: 0, title: "Youtube Resources" },
      { index: 1, title: "Q&A with Dan" }
    ]);
  });

  it("clicks the card at the requested index", () => {
    document.body.innerHTML = `
      <div role="button" aria-roledescription="sortable">A</div>
      <div role="button" aria-roledescription="sortable">B</div>
    `;
    let clicked = "";
    document.querySelectorAll('[role="button"]')[1]!.addEventListener("click", () => {
      clicked = "B";
    });
    clickModuleEntry(1);
    expect(clicked).toBe("B");
  });

  it("throws for an out-of-range index", () => {
    document.body.innerHTML = "";
    expect(() => clickModuleEntry(0)).toThrow(/No module card/);
  });
});

describe("scanVisibleLessons", () => {
  it("collects unique ?md= lesson links with their title", () => {
    document.body.innerHTML = `
      <a href="/nextgenai/classroom/34bba8b6?md=345b9b3548734b6d9f8820fe31d27761">
        <div><div title="I Tried AI Video Editing for 8 Days">I Tried AI Video Editing for 8 Days</div></div>
      </a>
      <a href="/nextgenai/classroom/34bba8b6?md=949f1d0bbaa846a0af535aba4750e8ba">
        <div><div title="The Easiest Way To Make AI Influencers">The Easiest Way To Make AI Influencers</div></div>
      </a>
      <a href="/nextgenai/classroom/34bba8b6?md=345b9b3548734b6d9f8820fe31d27761">duplicate</a>
    `;
    const lessons = scanVisibleLessons();
    expect(lessons).toHaveLength(2);
    expect(lessons[0]).toEqual({
      title: "I Tried AI Video Editing for 8 Days",
      url: "https://www.skool.com/nextgenai/classroom/34bba8b6?md=345b9b3548734b6d9f8820fe31d27761"
    });
  });

  it("returns an empty list when no lesson links are present", () => {
    document.body.innerHTML = "<div>nothing here</div>";
    expect(scanVisibleLessons()).toEqual([]);
  });
});
