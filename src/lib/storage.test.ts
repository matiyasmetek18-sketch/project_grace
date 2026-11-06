import { describe, expect, it } from "vitest";
import { buildCustomGathering, validateCustomEvent } from "./customEvent";
import { emptyStore, loadStore, saveStore, type StorageLike } from "./storage";

class MemoryStorage implements StorageLike {
  private map = new Map<string, string>();
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
}

describe("local store", () => {
  it("round-trips volunteers and ignores corrupt data", () => {
    const storage = new MemoryStorage();
    const store = emptyStore();
    store.volunteersByEvent["before-the-frost"] = [
      {
        id: "person-1",
        name: "  Nia  ",
        note: "I can bring gloves.",
        ranges: [{ date: "2026-11-21", start: "09:00", end: "12:00" }],
        taskIds: ["weed-ng"],
        flexible: true,
        example: true,
        createdAt: "2026-11-06T00:00:00.000Z",
      },
    ];
    expect(saveStore(store, storage)).toBe(true);
    const loaded = loadStore(storage);
    expect(loaded.volunteersByEvent["before-the-frost"][0]).toMatchObject({
      name: "Nia",
      example: false,
      flexible: true,
    });

    storage.setItem("grace.store.v1", "{");
    expect(loadStore(storage)).toEqual(emptyStore());
  });

  it("refuses to shadow the seeded gatherings", () => {
    const storage = new MemoryStorage();
    saveStore(
      {
        ...emptyStore(),
        customEvents: [
          {
            ...buildCustomGathering(
              {
                title: "Porch sitting",
                summary: "A quiet hour.",
                story: "",
                mode: "meet",
                windowStart: "2026-11-20",
                windowEnd: "2026-11-21",
                dayStart: "17:00",
                dayEnd: "19:00",
                areas: [{ name: "Porch", tasks: "" }],
              },
              "before-the-frost",
              "2026-11-06T00:00:00.000Z",
            ),
          },
        ],
      },
      storage,
    );
    expect(loadStore(storage).customEvents).toEqual([]);
  });
});

describe("custom gatherings", () => {
  it("asks for a name, a window, and a place", () => {
    const errors = validateCustomEvent({
      title: "",
      summary: "",
      story: "",
      mode: "work",
      windowStart: "2026-12-01",
      windowEnd: "2026-11-01",
      dayStart: "10:00",
      dayEnd: "10:30",
      areas: [{ name: "", tasks: "" }],
    });
    expect(errors.map((error) => error.id)).toEqual([
      "event-title",
      "event-summary",
      "event-start",
      "event-hours-start",
      "areas-fieldset",
    ]);
  });

  it("turns a blank task list into the area itself", () => {
    const gathering = buildCustomGathering(
      {
        title: "Bulb morning",
        summary: "Plant the bulbs.",
        story: "",
        mode: "work",
        windowStart: "2026-11-07",
        windowEnd: "2026-11-08",
        dayStart: "09:00",
        dayEnd: "12:00",
        areas: [{ name: "Front bed", tasks: "" }],
      },
      "event-bulb",
      "2026-11-06T00:00:00.000Z",
    );
    expect(gathering.tasks.map((task) => task.title)).toEqual(["Front bed"]);
    expect(gathering.featured).toBe(false);
  });
});
