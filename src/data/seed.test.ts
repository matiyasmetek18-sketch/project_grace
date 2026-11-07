import { describe, expect, it } from "vitest";
import { weekdayIndex } from "../lib/time";
import { seedEvents } from "./seed";

const requiredTasks = [
  "Repair railing on rental porch",
  "Quick cement pavers at rental back porch",
  "Cut down hazelnut tree in north greenbelt",
  "Cut down oak in south greenbelt",
  "Cut down a couple trees in mid greenbelt",
  "Complete weeding in north greenbelt",
  "Plant about 4 trees in north greenbelt",
  "Weed north front yard",
  "Move dirt from rental parking to north front yard",
  "Pave rental parking",
  "Weed wack north",
  "Weed wack platforms",
  "Weed wack -86 orchard",
  "Renovate carport shelving",
  "Weed and rotate -86 northwest",
  "Weed south",
  "Weed north",
  "Trellis Marion berries and black raspberries",
  "Rotate crops between yard and carport",
  "Repotting and saving dying trees",
  "Weeding and planting more blueberries",
];

describe("seeded gatherings", () => {
  it("keeps the host's outdoor task list", () => {
    const titles = seedEvents[0].tasks.map((task) => task.title);
    for (const title of requiredTasks) expect(titles).toContain(title);
    expect(titles).toContain("Finish adding line to the weed wacker");
  });

  it("does not invent a way to contact the host", () => {
    const blob = JSON.stringify(seedEvents);
    expect(blob).not.toMatch(/@/);
    expect(blob).not.toMatch(/\b\d{3}[-.)\s]\d{3}[-.)\s]\d{4}\b/);
  });

  it("keeps the work day focused on tasks and off Sundays", () => {
    const workDay = seedEvents[0];
    const copy = [...workDay.story, ...workDay.notes, workDay.summary, workDay.kicker].join(" ").toLowerCase();
    expect(copy).not.toMatch(/church|newsletter|teen|\bmen\b/);
    for (const event of seedEvents) {
      for (const volunteer of event.volunteers) {
        for (const range of volunteer.ranges) {
          expect(weekdayIndex(range.date)).not.toBe(0);
          expect(weekdayIndex(range.date)).not.toBe(4);
        }
      }
    }
  });

  it("labels every seeded person as an example and offers a second gathering", () => {
    for (const event of seedEvents) {
      expect(event.volunteers.length).toBeGreaterThan(0);
      expect(event.volunteers.every((volunteer) => volunteer.example)).toBe(true);
    }
    expect(seedEvents.some((event) => event.sample && event.mode === "meet")).toBe(true);
    expect(seedEvents.some((event) => event.featured && event.sketch === "grounds")).toBe(true);
  });
});
