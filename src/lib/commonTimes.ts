import type { TimeRange } from "../types";
import { formatHHMM, mergeRanges, minutes } from "./time";

export type Answer = {
  id: string;
  name: string;
  ranges: TimeRange[];
};

export type TimeSpan = {
  date: string;
  start: string;
  end: string;
  names: string[];
};

const DAY_START = 7 * 60;
const DAY_END = 21 * 60;

/** Segments of a day, including stretches with only one person. */
export function coverageSpans(answers: Answer[]): TimeSpan[] {
  const dates = [...new Set(answers.flatMap((answer) => answer.ranges.map((range) => range.date)))].sort();
  return dates.flatMap((date) => spansOnDate(date, answers));
}

/** Stretches where at least two people overlap, fullest first. */
export function commonSpans(answers: Answer[]): TimeSpan[] {
  return coverageSpans(answers)
    .filter((span) => span.names.length >= 2)
    .sort((a, b) => b.names.length - a.names.length || a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
}

function spansOnDate(date: string, answers: Answer[]): TimeSpan[] {
  const intervals: { id: string; name: string; start: number; end: number }[] = [];
  const points = new Set<number>();
  for (const answer of answers) {
    const own = mergeRanges(answer.ranges.filter((range) => range.date === date));
    for (const range of own) {
      const start = Math.max(DAY_START, minutes(range.start));
      const end = Math.min(DAY_END, minutes(range.end));
      if (!(end > start)) continue;
      intervals.push({ id: answer.id, name: answer.name, start, end });
      points.add(start);
      points.add(end);
    }
  }
  const marks = [...points].sort((a, b) => a - b);
  const spans: TimeSpan[] = [];
  for (let index = 0; index < marks.length - 1; index += 1) {
    const start = marks[index];
    const end = marks[index + 1];
    const present = intervals.filter((interval) => interval.start <= start && interval.end > start);
    if (present.length === 0) continue;
    const names: string[] = [];
    const seen = new Set<string>();
    for (const interval of present) {
      if (seen.has(interval.id)) continue;
      seen.add(interval.id);
      names.push(interval.name);
    }
    const previous = spans[spans.length - 1];
    const samePeople =
      previous !== undefined &&
      previous.end === formatHHMM(start) &&
      previous.names.join("\0") === names.join("\0");
    if (samePeople && previous) {
      previous.end = formatHHMM(end);
      continue;
    }
    spans.push({ date, start: formatHHMM(start), end: formatHHMM(end), names });
  }
  return spans;
}
