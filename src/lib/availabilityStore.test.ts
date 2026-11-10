import { describe, expect, it } from "vitest";
import { commonSpans } from "./commonTimes";
import { sameOffer, sanitizeEntries } from "./availabilityStore";

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

  it("sorts a slightly future createdAt last and drops one more than a day ahead", () => {
    const now = Date.parse("2026-11-10T12:00:00.000Z");
    const soon = new Date(now + 2 * 60 * 60 * 1000).toISOString();
    const ordered = sanitizeEntries(
      [
        { _id: "soon", name: "Soon", note: "", ranges: [range], createdAt: soon },
        { _id: "missing", name: "Missing", note: "", ranges: [range] },
        { _id: "bad", name: "Bad", note: "", ranges: [range], createdAt: "not-a-date" },
        { _id: "junk", name: "Junk", note: "", ranges: [range], createdAt: "9999-01-01T00:00:00.000Z" },
        { _id: "real", name: "Nia", note: "", ranges: [range], createdAt: "2026-11-01T00:00:00.000Z" },
      ],
      now,
    );
    expect(ordered.map((item) => item.id)).toEqual(["real", "soon", "missing", "bad"]);
    expect(commonSpans(ordered).some((span) => span.names.includes("Junk"))).toBe(false);
  });

  it("does not treat two offers as the same when createdAt differs", () => {
    const base = {
      id: "a",
      fromServer: true as const,
      name: "Nia",
      note: "",
      ranges: [range],
      createdAt: "2026-11-10T12:00:00.000Z",
    };
    expect(sameOffer(base, { ...base, id: "b" })).toBe(true);
    expect(sameOffer(base, { ...base, createdAt: "2026-11-10T12:00:01.000Z" })).toBe(false);
  });
});
