import type { AvailabilityEntry } from "./availabilityStore";
import { sameOffer, sanitizeEntries } from "./availabilityStore";
import { offeredDayMessage } from "./time";

/**
 * Shared list for everyone who opens the page.
 * A guest bin is removed after a few idle hours, so the keep-shared-answers
 * workflow reads this address on a schedule and the bin stays up.
 */
const COLLECTION = "https://dontlosedata.site/api/v1/9dc450ce-03a3-4c84-b91f-b7ad27cd2f39";

type StoredAnswer = Partial<AvailabilityEntry> & { _id?: string };

function echoedId(body: unknown): string {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "";
  const record = body as StoredAnswer;
  return typeof record._id === "string" ? record._id.trim() : "";
}

export async function fetchSharedAnswers(): Promise<AvailabilityEntry[]> {
  const response = await fetch(COLLECTION);
  if (!response.ok) throw new Error("The shared list did not load.");
  const body: unknown = await response.json();
  if (body == null) return [];
  if (!Array.isArray(body)) throw new Error("The shared list did not load.");
  return sanitizeEntries(body);
}

export async function publishSharedAnswer(entry: AvailabilityEntry): Promise<AvailabilityEntry> {
  for (const range of entry.ranges) {
    const message = offeredDayMessage(range.date);
    if (message) throw new Error(message);
  }
  const response = await fetch(COLLECTION, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: entry.name,
      note: entry.note,
      ranges: entry.ranges,
      createdAt: entry.createdAt,
    }),
  });
  if (!response.ok) throw new Error("The shared list did not save this answer.");
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const [saved] = sanitizeEntries([body]);
    if (saved) return saved;
    const serverId = echoedId(body);
    if (serverId) return { ...entry, id: serverId, fromServer: true };
  }
  const shared = await fetchSharedAnswers();
  const match = shared.find((item) => sameOffer(item, entry));
  if (match) return match;
  return { ...entry, fromServer: false };
}

export async function removeSharedAnswer(id: string): Promise<void> {
  const response = await fetch(`${COLLECTION}/id/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (response.status === 404) throw new Error("That answer is not on the shared list.");
  if (!response.ok) throw new Error("The shared list did not remove that answer.");
}
