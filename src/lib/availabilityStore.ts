import type { TimeRange } from "../types";
import { isClosedDay, isHHMM, isISODate, keepSeparateRanges, minutes } from "./time";

/**
 * createdAt is the time the page sent. The public bin docs add an id on POST and
 * return the stored JSON; they do not add a server clock. Clocks can each be about
 * a day off, so a stamp up to 7 days ahead still sorts as a real time and counts
 * in common times. A stamp further ahead (for example year 9999) stays in the list
 * but sorts last, so it cannot push a real answer out of the 200 cap, and it does
 * not count in common times.
 */
const FAR_FUTURE_MS = 7 * 24 * 60 * 60 * 1000;

export type AvailabilityEntry = {
  id: string;
  /** True when `id` is the server `_id`. A claimed client id is not removable. */
  fromServer: boolean;
  name: string;
  note: string;
  ranges: TimeRange[];
  createdAt: string;
};

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

/** Milliseconds for ordering, or null when the value is missing, invalid, or more than 7 days ahead. */
export function createdAtMillis(value: unknown, now = Date.now()): number | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  if (parsed > now + FAR_FUTURE_MS) return null;
  return parsed;
}

export function createdAtFarFuture(value: unknown, now = Date.now()): boolean {
  if (typeof value !== "string" || value.trim() === "") return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && parsed > now + FAR_FUTURE_MS;
}

/** Server-confirmed answers with a usable time. Pending and far-future rows do not count. */
export function countsInCommonTimes(entry: AvailabilityEntry, now = Date.now()): boolean {
  return entry.fromServer && !createdAtFarFuture(entry.createdAt, now);
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
