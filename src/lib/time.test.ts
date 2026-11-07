import { describe, expect, it } from "vitest";
import {
  dateSpanDays,
  defaultGatheringWindow,
  eachDate,
  eachGatheringDate,
  isISODate,
  mergeRanges,
  timePresets,
} from "./time";

describe("dates and hours", () => {
  it("rejects impossible calendar dates", () => {
    expect(isISODate("2026-02-31")).toBe(false);
    expect(isISODate("2026-11-14")).toBe(true);
  });

  it("lists an inclusive window", () => {
    expect(eachDate("2026-11-14", "2026-11-16")).toEqual(["2026-11-14", "2026-11-15", "2026-11-16"]);
    expect(dateSpanDays("2026-11-14", "2026-12-06")).toBe(22);
  });

  it("leaves Sunday off gathering calendars", () => {
    expect(eachGatheringDate("2026-11-14", "2026-11-16")).toEqual(["2026-11-14", "2026-11-16"]);
  });

  it("merges touching hours on the same day", () => {
    expect(
      mergeRanges([
        { date: "2026-11-21", start: "08:00", end: "12:00" },
        { date: "2026-11-21", start: "12:00", end: "16:00" },
        { date: "2026-11-22", start: "09:00", end: "11:00" },
      ]),
    ).toEqual([
      { date: "2026-11-21", start: "08:00", end: "16:00" },
      { date: "2026-11-22", start: "09:00", end: "11:00" },
    ]);
  });

  it("names morning and afternoon inside a work day", () => {
    expect(timePresets("08:00", "16:00").map((preset) => preset.label)).toEqual([
      "Morning",
      "Afternoon",
      "Whole day",
    ]);
  });

  it("starts a new gathering on the coming Saturday", () => {
    expect(defaultGatheringWindow(new Date(2026, 10, 6))).toEqual({
      start: "2026-11-07",
      end: "2026-11-22",
    });
  });
});
