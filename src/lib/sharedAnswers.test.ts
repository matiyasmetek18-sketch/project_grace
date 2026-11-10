import { afterEach, describe, expect, it, vi } from "vitest";
import type { AvailabilityEntry } from "./availabilityStore";
import { fetchSharedAnswers, publishSharedAnswer, removeSharedAnswer } from "./sharedAnswers";

const entry: AvailabilityEntry = {
  id: "pending-1",
  fromServer: false,
  name: "Nia",
  note: "",
  ranges: [{ date: "2026-11-13", start: "08:00", end: "12:00" }],
  createdAt: "2026-11-10T12:00:00.000Z",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("shared answers", () => {
  it("loads each answer under the server id", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        json([
          {
            _id: "server-9",
            id: "spoof-id",
            name: "Nia",
            note: "",
            ranges: entry.ranges,
            createdAt: entry.createdAt,
          },
        ]),
      ),
    );
    const [saved] = await fetchSharedAnswers();
    expect(saved.id).toBe("server-9");
    expect(saved.fromServer).toBe(true);
  });

  it("refetches the server id when the save response does not echo the record", async () => {
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      if ((init?.method ?? "GET").toUpperCase() === "POST") return json({ ok: true });
      return json([
        {
          _id: "server-9",
          id: "spoof-id",
          name: entry.name,
          note: entry.note,
          ranges: entry.ranges,
          createdAt: "2026-11-09T00:00:00.000Z",
        },
      ]);
    });
    vi.stubGlobal("fetch", fetchMock);
    const saved = await publishSharedAnswer(entry);
    expect(saved.id).toBe("server-9");
    expect(saved.fromServer).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps a server id from a partial save response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ _id: "server-7" })));
    const saved = await publishSharedAnswer(entry);
    expect(saved.id).toBe("server-7");
    expect(saved.fromServer).toBe(true);
  });

  it("returns the echoed record under the server id", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        json({
          _id: "server-3",
          id: "spoof-id",
          name: "Nia",
          note: "",
          ranges: entry.ranges,
          createdAt: entry.createdAt,
        }),
      ),
    );
    const saved = await publishSharedAnswer(entry);
    expect(saved.id).toBe("server-3");
  });

  it("rejects a past or closed day before saving", async () => {
    const fetchMock = vi.fn(async () =>
      json({
        _id: "server-1",
        name: entry.name,
        note: "",
        ranges: entry.ranges,
        createdAt: entry.createdAt,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      publishSharedAnswer({ ...entry, ranges: [{ date: "2020-01-06", start: "08:00", end: "12:00" }] }),
    ).rejects.toThrow(/already passed/);
    await expect(
      publishSharedAnswer({ ...entry, ranges: [{ date: "2026-11-15", start: "08:00", end: "12:00" }] }),
    ).rejects.toThrow(/Sundays are not on this list/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("treats delete of a missing answer as a failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 404 })));
    await expect(removeSharedAnswer("server-1")).rejects.toThrow(/not on the shared list/);
  });
});
