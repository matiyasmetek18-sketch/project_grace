import type { AvailabilityEntry } from "./availabilityStore";
import { sanitizeEntries } from "./availabilityStore";
import { offeredDayMessage } from "./time";

/**
 * Shared list for everyone who opens the page.
 * A guest bin is removed after a few idle hours, so the keep-shared-answers
 * workflow reads this address on a schedule and the bin stays up.
 */
const COLLECTION =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SHARED_ANSWERS_URL) ||
  "https://dontlosedata.site/api/v1/9dc450ce-03a3-4c84-b91f-b7ad27cd2f39";

type StoredAnswer = Partial<AvailabilityEntry> & { _id?: string };

export type PublishedAnswer = {
  entry: AvailabilityEntry;
  /** False when the POST succeeded but this page does not yet have the server id. */
  confirmed: boolean;
};

function echoedId(body: unknown): string {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "";
  const record = body as StoredAnswer;
  if (typeof record._id === "string" && record._id.trim()) return record._id.trim();
  if (
    typeof record.id === "string" &&
    !record.id.startsWith("pending-") &&
    !record.id.startsWith("client-") &&
    record.id !== "spoof-id"
  ) {
    return record.id.trim();
  }
  return "";
}

export async function fetchSharedAnswers(): Promise<AvailabilityEntry[]> {
  const response = await fetch(COLLECTION);
  if (!response.ok) throw new Error("The shared list did not load.");
  const body: unknown = await response.json();
  if (body == null) return [];
  if (!Array.isArray(body)) throw new Error("The shared list did not load.");
  return sanitizeEntries(body);
}

export async function publishSharedAnswer(entry: AvailabilityEntry): Promise<PublishedAnswer> {
  for (const range of entry.ranges) {
    const message = offeredDayMessage(range.date);
    if (message) throw new Error(message);
  }
  let response: Response;
  try {
    response = await fetch(COLLECTION, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: entry.name,
        note: entry.note,
        ranges: entry.ranges,
        createdAt: entry.createdAt,
      }),
    });
  } catch {
    throw new Error("The shared list could not be reached. Try again.");
  }
  if (!response.ok) throw new Error("The shared list did not save this answer.");
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const [saved] = sanitizeEntries([body]);
    if (saved) return { entry: saved, confirmed: true };
    const serverId = echoedId(body);
    if (serverId) return { entry: { ...entry, id: serverId, fromServer: true }, confirmed: true };
  }
  // The POST is already saved. A later list read must not turn that into a failure.
  return { entry: { ...entry, fromServer: false }, confirmed: false };
}

export async function removeSharedAnswer(id: string, passphrase?: string): Promise<"removed" | "already-removed"> {
  const headers: Record<string, string> = {};
  const token =
    passphrase ??
    (typeof sessionStorage !== "undefined" ? sessionStorage.getItem("grace_organizer_passphrase") ?? "" : "");
  if (token) headers["X-Organizer-Passphrase"] = token;
  let response: Response;
  try {
    response = await fetch(`${COLLECTION}/id/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers,
    });
  } catch {
    throw new Error("The shared list could not be reached. Try again.");
  }
  if (response.status === 401 || response.status === 403) {
    throw new Error("Only an organizer can remove answers from the shared list.");
  }
  if (response.status === 404) return "already-removed";
  if (!response.ok) throw new Error("The shared list did not remove that answer.");
  return "removed";
}
