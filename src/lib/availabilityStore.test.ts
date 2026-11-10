import { describe, expect, it } from "vitest";
import { commonSpans } from "./commonTimes";
import * as store from "./availabilityStore";

const { countsInCommonTimes, sameOffer, sanitizeEntries } = store;

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
  it("does not keep the unused local-save helpers", () => {
    expect("saveEntries" in store).toBe(false);
    expect("safeLocal" in store).toBe(false);
    expect("AVAILABILITY_KEY" in store).toBe(false);
  });

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

  it("keeps a day of clock skew visible and sorts year 9999 last", () => {
    const now = Date.parse("2026-11-10T12:00:00.000Z");
    const viewerNow = now - 23 * 60 * 60 * 1000;
    const submitterStamp = new Date(now + 2 * 60 * 60 * 1000).toISOString();
    const junk = Array.from({ length: 200 }, (_, index) => ({
      _id: `junk-${index}`,
      name: "Junk",
      note: "",
      ranges: [range],
      createdAt: "9999-01-01T00:00:00.000Z",
    }));
    const ordered = sanitizeEntries(
      [
        ...junk,
        { _id: "skew", name: "Skew", note: "", ranges: [range], createdAt: submitterStamp },
        { _id: "real", name: "Nia", note: "", ranges: [range], createdAt: "2026-11-01T00:00:00.000Z" },
      ],
      viewerNow,
    );
    expect(ordered).toHaveLength(200);
    expect(ordered.map((item) => item.id)).toContain("skew");
    expect(ordered.map((item) => item.id)).toContain("real");
    expect(ordered[ordered.length - 1].id.startsWith("junk")).toBe(true);
    const counted = ordered.filter((item) => countsInCommonTimes(item, viewerNow));
    expect(counted.map((item) => item.id)).toEqual(expect.arrayContaining(["skew", "real"]));
    expect(counted.some((item) => item.name === "Junk")).toBe(false);
    expect(commonSpans(counted).some((span) => span.names.includes("Junk"))).toBe(false);
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
