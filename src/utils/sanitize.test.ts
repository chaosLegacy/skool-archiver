import { describe, expect, it } from "vitest";
import { formatFilename, sanitizeFilename } from "./sanitize";

describe("sanitizeFilename", () => {
  it("replaces filesystem-invalid characters", () => {
    expect(sanitizeFilename('a/b:c*d?e"f<g>h|i')).toBe("a_b_c_d_e_f_g_h_i");
  });

  it("collapses whitespace and falls back for empty input", () => {
    expect(sanitizeFilename("  Hello   World  ")).toBe("Hello_World");
    expect(sanitizeFilename("   ")).toBe("untitled");
  });

  it("truncates to the max length", () => {
    expect(sanitizeFilename("a".repeat(200), 10)).toHaveLength(10);
  });
});

describe("formatFilename", () => {
  it("substitutes known tokens and sanitizes the result", () => {
    expect(formatFilename("{order}-{title}", { order: 3, title: "My Lesson" })).toBe(
      "3-My_Lesson"
    );
  });

  it("leaves unknown tokens untouched", () => {
    expect(formatFilename("{unknown}", {})).toBe("{unknown}");
  });
});
