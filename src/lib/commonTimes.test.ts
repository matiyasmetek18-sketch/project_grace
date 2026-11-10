import { describe, expect, it } from "vitest";
import { commonSpans, coverageSpans } from "./commonTimes";

describe("common times", () => {
  it("keeps morning and afternoon apart and finds where two people overlap", () => {
    const answers = [
      {
        id: "a",
        name: "Ada",
        ranges: [
          { date: "2026-11-13", start: "08:00", end: "12:00" },
          { date: "2026-11-13", start: "12:00", end: "16:00" },
        ],
      },
      {
        id: "b",
        name: "Bo",
        ranges: [{ date: "2026-11-13", start: "10:00", end: "14:00" }],
      },
    ];
    expect(commonSpans(answers)).toEqual([
      { date: "2026-11-13", start: "10:00", end: "14:00", names: ["Ada", "Bo"] },
    ]);
    const covered = coverageSpans(answers).map((span) => `${span.start}-${span.end}:${span.names.length}`);
    expect(covered).toEqual(["08:00-10:00:1", "10:00-14:00:2", "14:00-16:00:1"]);
  });

  it("counts one person once when that person's ranges overlap", () => {
    const ada = {
      id: "a",
      name: "Ada",
      ranges: [
        { date: "2026-11-13", start: "08:00", end: "12:00" },
        { date: "2026-11-13", start: "10:00", end: "14:00" },
      ],
    };
    expect(coverageSpans([ada])).toEqual([{ date: "2026-11-13", start: "08:00", end: "14:00", names: ["Ada"] }]);
    expect(commonSpans([ada])).toEqual([]);

    const withBo = [
      ada,
      { id: "b", name: "Bo", ranges: [{ date: "2026-11-13", start: "09:00", end: "11:00" }] },
    ];
    expect(commonSpans(withBo)).toEqual([
      { date: "2026-11-13", start: "09:00", end: "11:00", names: ["Ada", "Bo"] },
    ]);
    expect(coverageSpans(withBo).map((span) => `${span.start}-${span.end}:${span.names.length}`)).toEqual([
      "08:00-09:00:1",
      "09:00-11:00:2",
      "11:00-14:00:1",
    ]);
  });
});
