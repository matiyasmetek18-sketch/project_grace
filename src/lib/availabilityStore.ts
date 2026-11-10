import type { TimeRange } from "../types";
import { uid } from "./id";
import { isHHMM, isISODate, keepSeparateRanges, minutes } from "./time";

export const AVAILABILITY_KEY = "grace.availability.v1";

export type AvailabilityEntry = {
  id: string;
  name: string;
  note: string;
  ranges: TimeRange[];
  createdAt: string;
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function safeLocal(): StorageLike | null {
  try {
    const probe = "__grace_avail__";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return null;
  }
}

function isRange(value: unknown): value is TimeRange {
  if (!value || typeof value !== "object") return false;
  const range = value as TimeRange;
  return isISODate(range.date) && isHHMM(range.start) && isHHMM(range.end) && minutes(range.end) > minutes(range.start);
}

export function sanitizeEntries(value: unknown): AvailabilityEntry[] {
  if (!Array.isArray(value)) return [];
  const entries = value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const entry = item as Partial<AvailabilityEntry> & { _id?: unknown };
      if (typeof entry.name !== "string") return null;
      const name = entry.name.trim().slice(0, 60);
      const ranges = Array.isArray(entry.ranges) ? keepSeparateRanges(entry.ranges.filter(isRange)).slice(0, 40) : [];
      if (!name || ranges.length === 0) return null;
      const serverId = typeof entry._id === "string" ? entry._id.trim().slice(0, 80) : "";
      const clientId = typeof entry.id === "string" ? entry.id.trim().slice(0, 80) : "";
      return {
        id: serverId || clientId || uid("person"),
        name,
        note: typeof entry.note === "string" ? entry.note.slice(0, 240) : "",
        ranges,
        createdAt: typeof entry.createdAt === "string" ? entry.createdAt : new Date(0).toISOString(),
      };
    })
    .filter((entry): entry is AvailabilityEntry => entry !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return entries.slice(0, 200);
}

export function loadEntries(storage: StorageLike | null = safeLocal()): AvailabilityEntry[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(AVAILABILITY_KEY);
    if (!raw) return [];
    return sanitizeEntries(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

export function saveEntries(entries: AvailabilityEntry[], storage: StorageLike | null = safeLocal()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(AVAILABILITY_KEY, JSON.stringify(entries));
    return true;
  } catch {
    return false;
  }
}
