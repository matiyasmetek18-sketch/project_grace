import { describe, expect, it } from "vitest";
import { seedEvents } from "../data/seed";
import { weekdayIndex } from "./time";
import { areaPull, blockPhrase, buildOverlap, heatStep } from "./overlap";

const workDay = seedEvents[0];
const welcome = seedEvents[1];

describe("overlap", () => {
  it("finds Saturday November 21, 10:00–12:00, as the work day's strongest block", () => {
    const model = buildOverlap(workDay, workDay.volunteers);
    expect(model.blocks[0]).toMatchObject({
      date: "2026-11-21",
      start: "10:00",
      end: "12:00",
    });
    expect(model.blocks[0].people.map((person) => person.name).sort()).toEqual([
      "Amina",
      "Chris",
      "Elena",
      "Marcus",
      "Sam",
    ]);
    expect(model.dates.every((date) => weekdayIndex(date) !== 0 && weekdayIndex(date) !== 4)).toBe(true);
    expect(model.blocks[1]).toMatchObject({ date: "2026-11-14", start: "09:00", end: "11:00" });
    expect(model.blocks[1].people).toHaveLength(3);
    expect(model.max).toBeGreaterThanOrEqual(5);
  });

  it("finds the winter planning overlap on December 4", () => {
    const model = buildOverlap(welcome, welcome.volunteers);
    expect(model.blocks[0]).toMatchObject({
      date: "2026-12-04",
      start: "18:00",
      end: "19:00",
    });
    expect(model.blocks[0].people).toHaveLength(3);
  });

  it("does not double-count one person who offers overlapping hours", () => {
    const model = buildOverlap(workDay, [
      {
        ...workDay.volunteers[0],
        ranges: [
          { date: "2026-11-21", start: "10:00", end: "12:00" },
          { date: "2026-11-21", start: "11:00", end: "13:00" },
        ],
      },
    ]);
    const cell = model.cells
      .flat()
      .find((item) => item.date === "2026-11-21" && item.start === "11:00");
    expect(cell?.people).toHaveLength(1);
  });

  it("counts each person once for an area, even with several tasks there", () => {
    const pull = areaPull(workDay, workDay.volunteers, () => "open");
    const north = pull.areas.find((area) => area.areaId === "north");
    const rental = pull.areas.find((area) => area.areaId === "rental");
    expect(north?.count).toBe(3);
    expect(rental?.count).toBe(3);
    expect(north?.people.map((person) => person.name).sort()).toEqual(["Amina", "Elena", "Sam"]);
  });

  it("drops a task from the pull once it is marked done", () => {
    const pull = areaPull(workDay, workDay.volunteers, (taskId) => (taskId === "hazelnut" ? "done" : "open"));
    const north = pull.areas.find((area) => area.areaId === "north");
    expect(north?.tasks.some((task) => task.taskId === "hazelnut")).toBe(false);
    expect(north?.people.map((person) => person.name).sort()).toEqual(["Amina", "Elena"]);
  });

  it("speaks about example people plainly", () => {
    expect(blockPhrase(workDay.volunteers.map((volunteer) => ({
      id: volunteer.id,
      name: volunteer.name,
      example: true,
    })))).toBe("5 example people share this whole block");
    expect(heatStep(0, 5)).toBe(0);
    expect(heatStep(5, 5)).toBe(5);
    expect(heatStep(1, 1)).toBe(5);
  });
});
