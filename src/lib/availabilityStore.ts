import type { TimeRange } from "../types";
import { isClosedDay, isHHMM, isISODate, keepSeparateRanges, minutes } from "./time";

/**
 * createdAt rules:
 * - More than 5 minutes ahead of now is not used as a real time. Those rows sort after
 *   answers with a usable time. This skew is for sort order only.
 * - More than 24 hours ahead of now is dropped. Those rows are not shown and do not
 *   count in common times. They can still exist in the public list.
 */
const CREATED_AT_SKEW_MS = 5 * 60 * 1000;
const CREATED_AT_DROP_MS = 24 * 60 * 60 * 1000;

export const AVAILABILITY_KEY = "grace.availability.v1";

export type AvailabilityEntry = {
  id: string;
  /** True when `id` is the server `_id`. A claimed client id is not removable. */
  fromServer: boolean;
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
  return (
    isISODate(range.date) &&
    !isClosedDay(range.date) &&
    isHHMM(range.start) &&
    isHHMM(range.end) &&
    minutes(range.end) > minutes(range.start)
  );
}

/** Milliseconds for ordering, or null when the value is missing, invalid, or more than 5 minutes ahead. */
export function createdAtMillis(value: unknown, now = Date.now()): number | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  if (parsed > now + CREATED_AT_SKEW_MS) return null;
  return parsed;
}

function createdAtTooFarAhead(value: unknown, now: number): boolean {
  if (typeof value !== "string" || value.trim() === "") return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && parsed > now + CREATED_AT_DROP_MS;
}

export function sameOffer(a: AvailabilityEntry, b: AvailabilityEntry): boolean {
  if (a.name !== b.name || a.note !== b.note || a.createdAt !== b.createdAt || a.ranges.length !== b.ranges.length) {
    return false;
  }
  return a.ranges.every((range, index) => {
    const other = b.ranges[index];
    return range.date === other.date && range.start === other.start && range.end === other.end;
  });
}

export function sanitizeEntries(value: unknown, now = Date.now()): AvailabilityEntry[] {
  if (!Array.isArray(value)) return [];
  const ranked: { entry: AvailabilityEntry; sortKey: number | null }[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Partial<AvailabilityEntry> & { _id?: unknown };
    if (typeof entry.name !== "string") continue;
    const name = entry.name.trim().slice(0, 60);
    const ranges = Array.isArray(entry.ranges) ? keepSeparateRanges(entry.ranges.filter(isRange)).slice(0, 40) : [];
    if (!name || ranges.length === 0) continue;
    const serverId = typeof entry._id === "string" ? entry._id.trim().slice(0, 80) : "";
    if (!serverId) continue;
    const createdAt = typeof entry.createdAt === "string" ? entry.createdAt : "";
    if (createdAtTooFarAhead(createdAt, now)) continue;
    ranked.push({
      sortKey: createdAtMillis(createdAt, now),
      entry: {
        id: serverId,
        fromServer: true,
        name,
        note: typeof entry.note === "string" ? entry.note.slice(0, 240) : "",
        ranges,
        createdAt,
      },
    });
  }
  ranked.sort((a, b) => {
    if (a.sortKey == null && b.sortKey == null) return 0;
    if (a.sortKey == null) return 1;
    if (b.sortKey == null) return -1;
    return b.sortKey - a.sortKey;
  });
  return ranked.slice(0, 200).map((item) => item.entry);
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
