import { describe, expect, it } from "vitest";
import {
  dateSpanDays,
  dayChoiceMessage,
  dayOrderMessage,
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

  it("leaves Sunday and Thursday off gathering calendars", () => {
    expect(eachGatheringDate("2026-11-11", "2026-11-16")).toEqual([
      "2026-11-11",
      "2026-11-13",
      "2026-11-14",
      "2026-11-16",
    ]);
  });

  it("accepts one real weekday and refuses a blank, a Sunday, a Thursday, or a duplicate", () => {
    expect(dayChoiceMessage("", [])).toBe("Choose a day.");
    expect(dayChoiceMessage("2026-11-08", [])).toBe("Sundays are not on this list. Choose another day.");
    expect(dayChoiceMessage("2026-11-12", [])).toBe("Thursdays are not on this list. Choose another day.");
    expect(dayChoiceMessage("2026-11-07", ["2026-11-07"])).toBe("That day is already on your list.");
    expect(dayChoiceMessage("2026-11-09", ["2026-11-07"])).toBeNull();
  });

  it("refuses a last day that comes before the first", () => {
    expect(dayOrderMessage("2026-11-14", "2026-11-07")).toBe(
      "The last day has to be the same day as the first, or a later day.",
    );
    expect(dayOrderMessage("2026-11-07", "2026-11-07")).toBeNull();
    expect(dayOrderMessage("2026-11-07", "2026-11-21")).toBeNull();
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
