import type { TimeRange } from "../types";

export const SLOT_MINUTES = 30;

const fullDate = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
});
const monthDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const monthDayLong = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" });
const monthDayYear = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});
const weekdayShort = new Intl.DateTimeFormat("en-US", { weekday: "short" });
const timeFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

export function isHHMM(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function minutes(hhmm: string): number {
  if (!isHHMM(hhmm)) return Number.NaN;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function formatHHMM(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function formatISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return formatISODate(parseISODate(value)) === value;
}

/** Null when the last day is the first day or later. */
export function dayOrderMessage(first: string, last: string): string | null {
  if (!isISODate(first) || !isISODate(last)) return "Choose a real first day and last day.";
  if (last < first) return "The last day has to be the same day as the first, or a later day.";
  return null;
}

export function dateSpanDays(start: string, end: string): number {
  const a = parseISODate(start).getTime();
  const b = parseISODate(end).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function eachDate(start: string, end: string): string[] {
  if (!isISODate(start) || !isISODate(end) || start > end) return [];
  const out: string[] = [];
  const cur = parseISODate(start);
  while (out.length < 62) {
    const iso = formatISODate(cur);
    out.push(iso);
    if (iso === end) break;
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/** Gathering calendars leave Sunday off. */
export function eachGatheringDate(start: string, end: string): string[] {
  return eachDate(start, end).filter((iso) => parseISODate(iso).getDay() !== 0);
}

export function eachSlotStart(dayStart: string, dayEnd: string): string[] {
  const start = minutes(dayStart);
  const end = minutes(dayEnd);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
  const out: string[] = [];
  for (let t = start; t + SLOT_MINUTES <= end; t += SLOT_MINUTES) {
    out.push(formatHHMM(t));
  }
  return out;
}

export function compareRanges(a: TimeRange, b: TimeRange): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return minutes(a.start) - minutes(b.start);
}

/** Join ranges on the same day that touch or overlap. */
export function mergeRanges(ranges: TimeRange[]): TimeRange[] {
  const byDate = new Map<string, TimeRange[]>();
  for (const range of ranges) {
    if (!isISODate(range.date) || !isHHMM(range.start) || !isHHMM(range.end)) continue;
    if (minutes(range.end) <= minutes(range.start)) continue;
    const list = byDate.get(range.date) ?? [];
    list.push(range);
    byDate.set(range.date, list);
  }
  const out: TimeRange[] = [];
  for (const [date, list] of byDate) {
    const sorted = [...list].sort((a, b) => minutes(a.start) - minutes(b.start));
    let current = { ...sorted[0] };
    for (const range of sorted.slice(1)) {
      if (minutes(range.start) <= minutes(current.end)) {
        if (minutes(range.end) > minutes(current.end)) current = { ...current, end: range.end };
      } else {
        out.push(current);
        current = { ...range };
      }
    }
    out.push({ ...current, date });
  }
  return out.sort(compareRanges);
}

export function weekdayIndex(iso: string): number {
  return parseISODate(iso).getDay();
}

/** Monday-start weeks, in the order the dates appear. Sundays are omitted when the list already skipped them. */
export function groupWeeks(dates: string[]): string[][] {
  const groups = new Map<string, string[]>();
  for (const iso of dates) {
    const date = parseISODate(iso);
    const day = date.getDay();
    const monday = new Date(date);
    monday.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
    const key = formatISODate(monday);
    const list = groups.get(key) ?? [];
    list.push(iso);
    groups.set(key, list);
  }
  return [...groups.values()];
}

export function formatFullDate(iso: string): string {
  return fullDate.format(parseISODate(iso));
}

export function formatMonthDay(iso: string): string {
  return monthDay.format(parseISODate(iso));
}

export function formatWeekdayShort(iso: string): string {
  return weekdayShort.format(parseISODate(iso));
}

export function formatDayNum(iso: string): string {
  return String(parseISODate(iso).getDate());
}

export function formatTime(hhmm: string): string {
  const total = minutes(hhmm);
  if (!Number.isFinite(total)) return hhmm;
  const date = new Date(2026, 0, 1, 0, 0, 0, 0);
  date.setHours(Math.floor(total / 60), total % 60, 0, 0);
  return timeFmt.format(date);
}

export function formatWindow(start: string, end: string): string {
  if (!isISODate(start) || !isISODate(end)) return "";
  if (start === end) return monthDayYear.format(parseISODate(start));
  const a = parseISODate(start);
  const b = parseISODate(end);
  const left =
    a.getFullYear() === b.getFullYear() ? monthDayLong.format(a) : monthDayYear.format(a);
  return `${left} – ${monthDayYear.format(b)}`;
}

export function formatRange(range: TimeRange): string {
  return `${formatFullDate(range.date)}, ${formatTime(range.start)} – ${formatTime(range.end)}`;
}

export type TimePreset = {
  id: string;
  label: string;
  start: string;
  end: string;
};

export function timePresets(dayStart: string, dayEnd: string): TimePreset[] {
  const start = minutes(dayStart);
  const end = minutes(dayEnd);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end - start < 60) return [];
  let mid = Math.round((start + end) / 2 / SLOT_MINUTES) * SLOT_MINUTES;
  if (mid <= start) mid = start + SLOT_MINUTES;
  if (mid >= end) mid = end - SLOT_MINUTES;
  const morning = start < 12 * 60 && end <= 17 * 60;
  const evening = start >= 15 * 60;
  const first = morning ? "Morning" : evening ? "Earlier evening" : "First half";
  const second = morning ? "Afternoon" : evening ? "Later evening" : "Second half";
  const all = morning ? "Whole day" : evening ? "Whole evening" : "Whole window";
  return [
    { id: "first", label: first, start: formatHHMM(start), end: formatHHMM(mid) },
    { id: "second", label: second, start: formatHHMM(mid), end: formatHHMM(end) },
    { id: "all", label: all, start: formatHHMM(start), end: formatHHMM(end) },
  ];
}

export function halfHours(from = "06:00", to = "21:30"): string[] {
  const start = minutes(from);
  const end = minutes(to);
  const out: string[] = [];
  for (let t = start; t <= end; t += SLOT_MINUTES) out.push(formatHHMM(t));
  return out;
}

export function nextSaturday(today: Date): Date {
  const cur = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const delta = (6 - cur.getDay() + 7) % 7;
  cur.setDate(cur.getDate() + delta);
  return cur;
}

export function defaultGatheringWindow(today = new Date()): { start: string; end: string } {
  const startDate = nextSaturday(today);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 15);
  return { start: formatISODate(startDate), end: formatISODate(endDate) };
}

export function slotHourLabel(start: string): string {
  const total = minutes(start);
  if (!Number.isFinite(total) || total % 60 !== 0) return "";
  const h = Math.floor(total / 60);
  const suffix = h >= 12 ? "p" : "a";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}${suffix}`;
}
