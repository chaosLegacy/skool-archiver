import { describe, expect, it } from "vitest";
import { estimateRemainingMs, formatDuration } from "./time";

describe("formatDuration", () => {
  it("formats seconds, minutes, and hours", () => {
    expect(formatDuration(45_000)).toBe("45s");
    expect(formatDuration(125_000)).toBe("2m 5s");
    expect(formatDuration(3_725_000)).toBe("1h 2m");
  });

  it("handles invalid input", () => {
    expect(formatDuration(-1)).toBe("--");
    expect(formatDuration(NaN)).toBe("--");
  });
});

describe("estimateRemainingMs", () => {
  it("returns undefined with no progress yet", () => {
    expect(estimateRemainingMs(Date.now(), 0, 10)).toBeUndefined();
  });

  it("scales remaining time by items left", () => {
    const start = Date.now() - 1000; // 1s elapsed for 1 completed item
    const remaining = estimateRemainingMs(start, 1, 4);
    expect(remaining).toBeGreaterThan(2500);
    expect(remaining).toBeLessThan(3500);
  });
});
