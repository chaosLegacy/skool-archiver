import { describe, expect, it } from "vitest";
import { hashString, idFromUrl, slugify } from "./id";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Module 1: Getting Started!")).toBe("module-1-getting-started");
  });

  it("falls back for empty/unsafe input", () => {
    expect(slugify("!!!")).toBe("untitled");
  });
});

describe("hashString / idFromUrl", () => {
  it("is deterministic for the same input", () => {
    expect(hashString("hello")).toBe(hashString("hello"));
    expect(idFromUrl("https://skool.com/x/1")).toBe(idFromUrl("https://skool.com/x/1"));
  });

  it("differs for different input", () => {
    expect(hashString("hello")).not.toBe(hashString("world"));
  });
});
