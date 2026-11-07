import type { AvailabilityEntry } from "./availabilityStore";
import { sanitizeEntries } from "./availabilityStore";

/** Public collection. Anyone with this page can read and add answers. */
const COLLECTION = "https://crudcrud.com/api/b4814200ecf84242a217167d83ce816e/answers";

type StoredAnswer = AvailabilityEntry & { _id?: string };

function toEntry(record: StoredAnswer): AvailabilityEntry {
  return {
    id: record._id || record.id,
    name: record.name,
    note: record.note,
    ranges: record.ranges,
    createdAt: record.createdAt,
  };
}

export async function fetchSharedAnswers(): Promise<AvailabilityEntry[]> {
  const response = await fetch(COLLECTION);
  if (!response.ok) throw new Error("The shared list did not load.");
  const body: unknown = await response.json();
  if (!Array.isArray(body)) return [];
  return sanitizeEntries(body.map((item) => toEntry(item as StoredAnswer)));
}

export async function publishSharedAnswer(entry: AvailabilityEntry): Promise<AvailabilityEntry> {
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
  const saved = (await response.json()) as StoredAnswer;
  const [entrySaved] = sanitizeEntries([toEntry({ ...saved, id: saved._id || entry.id })]);
  if (!entrySaved) throw new Error("The shared list did not save this answer.");
  return entrySaved;
}

export async function removeSharedAnswer(id: string): Promise<void> {
  const response = await fetch(`${COLLECTION}/${id}`, { method: "DELETE" });
  if (!response.ok && response.status !== 404) throw new Error("The shared list did not remove that answer.");
}
