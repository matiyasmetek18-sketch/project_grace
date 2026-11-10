import { describe, expect, it } from "vitest";
import { sanitizeEntries } from "./availabilityStore";

const range = { date: "2026-11-13", start: "08:00", end: "09:00" };

function entry(index: number, createdAt?: string) {
  return {
    _id: `server-${index}`,
    id: `client-${index}`,
    name: "Nia",
    note: "",
    ranges: [range],
    createdAt: createdAt ?? new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
  };
}

describe("sanitizeEntries", () => {
  it("keeps the newest answers when more than 200 are returned", () => {
    const raw = Array.from({ length: 201 }, (_, index) => entry(index));
    const sanitized = sanitizeEntries(raw);
    expect(sanitized).toHaveLength(200);
    expect(sanitized[0].id).toBe("server-200");
    expect(sanitized.some((item) => item.id === "server-0")).toBe(false);
  });

  it("uses the server id instead of a client id", () => {
    const [saved] = sanitizeEntries([
      {
        _id: "server-1",
        id: "spoof-id",
        name: "Nia",
        note: "",
        ranges: [range],
        createdAt: "2026-11-10T00:00:00.000Z",
      },
    ]);
    expect(saved.id).toBe("server-1");
    expect(saved.fromServer).toBe(true);
  });

  it("rejects a spoofed id when the server did not assign one", () => {
    expect(
      sanitizeEntries([
        {
          id: "spoof-id",
          name: "Nia",
          note: "",
          ranges: [range],
          createdAt: "2026-11-10T00:00:00.000Z",
        },
      ]),
    ).toEqual([]);
  });

  it("drops Sunday and Thursday ranges and keeps a past weekday", () => {
    const [saved] = sanitizeEntries([
      {
        _id: "server-1",
        name: "Nia",
        note: "",
        ranges: [
          { date: "2026-11-08", start: "08:00", end: "12:00" },
          { date: "2026-11-12", start: "08:00", end: "12:00" },
          { date: "2026-11-09", start: "08:00", end: "12:00" },
        ],
        createdAt: "2026-11-01T00:00:00.000Z",
      },
    ]);
    expect(saved.ranges).toEqual([{ date: "2026-11-09", start: "08:00", end: "12:00" }]);
  });

  it("sorts missing, invalid, and future createdAt last so they cannot crowd out real answers", () => {
    const now = Date.parse("2026-11-10T12:00:00.000Z");
    const junk = Array.from({ length: 200 }, (_, index) => ({
      _id: `junk-${index}`,
      name: "Junk",
      note: "",
      ranges: [range],
      createdAt: "9999-01-01T00:00:00.000Z",
    }));
    const sanitized = sanitizeEntries(
      [
        ...junk,
        {
          _id: "real",
          name: "Nia",
          note: "",
          ranges: [range],
          createdAt: "2026-11-01T00:00:00.000Z",
        },
      ],
      now,
    );
    expect(sanitized).toHaveLength(200);
    expect(sanitized[0].id).toBe("real");
    expect(sanitized.some((item) => item.id === "junk-199")).toBe(false);

    const ordered = sanitizeEntries(
      [
        { _id: "future", name: "Future", note: "", ranges: [range], createdAt: "9999-06-01T00:00:00.000Z" },
        { _id: "missing", name: "Missing", note: "", ranges: [range] },
        { _id: "bad", name: "Bad", note: "", ranges: [range], createdAt: "not-a-date" },
        { _id: "real", name: "Nia", note: "", ranges: [range], createdAt: "2026-11-01T00:00:00.000Z" },
      ],
      now,
    );
    expect(ordered.map((item) => item.id)).toEqual(["real", "future", "missing", "bad"]);
  });
});
