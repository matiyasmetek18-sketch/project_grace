import { afterEach, describe, expect, it, vi } from "vitest";
import type { AvailabilityEntry } from "./availabilityStore";
import { fetchSharedAnswers, publishSharedAnswer } from "./sharedAnswers";

const entry: AvailabilityEntry = {
  id: "person-1",
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
  });

  it("treats a saved answer as sent when the response does not echo the record", async () => {
    const fetchMock = vi.fn(async () => json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(publishSharedAnswer(entry)).resolves.toEqual(entry);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps a server id from a partial save response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ _id: "server-7" })));
    await expect(publishSharedAnswer(entry)).resolves.toEqual({ ...entry, id: "server-7" });
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

  it("still rejects a save the server did not accept", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ ok: false }, 500)));
    await expect(publishSharedAnswer(entry)).rejects.toThrow(/did not save/);
  });
});
