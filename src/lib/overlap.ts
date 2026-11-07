import type { Gathering, TaskStatus, Volunteer } from "../types";
import { eachGatheringDate, eachSlotStart, minutes, SLOT_MINUTES, formatHHMM } from "./time";

export type PersonRef = {
  id: string;
  name: string;
  example: boolean;
};

export type HeatCell = {
  date: string;
  start: string;
  end: string;
  people: PersonRef[];
};

export type SharedBlock = {
  date: string;
  start: string;
  end: string;
  people: PersonRef[];
  slotCount: number;
};

export type OverlapModel = {
  dates: string[];
  slotStarts: string[];
  cells: HeatCell[][];
  max: number;
  blocks: SharedBlock[];
};

export type TaskPull = {
  taskId: string;
  title: string;
  count: number;
  people: PersonRef[];
};

export type AreaPull = {
  areaId: string;
  name: string;
  blurb: string;
  place?: string;
  count: number;
  people: PersonRef[];
  tasks: TaskPull[];
};

function toPerson(volunteer: Volunteer): PersonRef {
  return { id: volunteer.id, name: volunteer.name, example: volunteer.example };
}

function intersect(current: PersonRef[], next: PersonRef[]): PersonRef[] {
  const ids = new Set(next.map((person) => person.id));
  return current.filter((person) => ids.has(person.id));
}

/** True when two blocks share a day and sit on top of each other, or touch within half an hour. */
function blocksConflict(
  a: { date: string; start: string; end: string },
  b: { date: string; start: string; end: string },
): boolean {
  if (a.date !== b.date) return false;
  const gap = 30;
  return minutes(a.start) < minutes(b.end) + gap && minutes(b.start) < minutes(a.end) + gap;
}

/**
 * Score a block by the number of people who can stay for every slot in it,
 * then by how long that shared stretch lasts. A higher minimum wins over a
 * longer stretch with fewer people, because the question is when a group
 * can actually gather.
 */
function scoreBlock(people: number, slotCount: number): number {
  return people * 1_000_000 + slotCount * 1_000;
}

export function buildOverlap(event: Gathering, volunteers: Volunteer[]): OverlapModel {
  const dates = eachGatheringDate(event.windowStart, event.windowEnd);
  const slotStarts = eachSlotStart(event.dayStart, event.dayEnd);
  const cells: HeatCell[][] = dates.map((date) =>
    slotStarts.map((start) => ({
      date,
      start,
      end: formatHHMM(minutes(start) + SLOT_MINUTES),
      people: [],
    })),
  );

  const dateIndex = new Map(dates.map((date, index) => [date, index]));

  for (const volunteer of volunteers) {
    const person = toPerson(volunteer);
    for (const range of volunteer.ranges) {
      const row = dateIndex.get(range.date);
      if (row === undefined) continue;
      const rangeStart = minutes(range.start);
      const rangeEnd = minutes(range.end);
      if (!Number.isFinite(rangeStart) || !Number.isFinite(rangeEnd) || rangeEnd <= rangeStart) continue;
      for (let index = 0; index < slotStarts.length; index += 1) {
        const slotStart = minutes(slotStarts[index]);
        const slotEnd = slotStart + SLOT_MINUTES;
        if (rangeStart < slotEnd && slotStart < rangeEnd) {
          const cell = cells[row][index];
          if (!cell.people.some((existing) => existing.id === person.id)) cell.people.push(person);
        }
      }
    }
  }

  type Candidate = SharedBlock & { score: number };
  const candidates: Candidate[] = [];
  for (const row of cells) {
    for (let start = 0; start < row.length; start += 1) {
      if (row[start].people.length === 0) continue;
      let people = row[start].people;
      for (let end = start; end < row.length; end += 1) {
        people = end === start ? row[start].people : intersect(people, row[end].people);
        if (people.length === 0) break;
        const slotCount = end - start + 1;
        candidates.push({
          date: row[start].date,
          start: row[start].start,
          end: row[end].end,
          people,
          slotCount,
          score: scoreBlock(people.length, slotCount),
        });
      }
    }
  }

  const longEnough = candidates.filter((candidate) => candidate.slotCount >= 2);
  const pool = longEnough.length > 0 ? longEnough : candidates;
  pool.sort(
    (a, b) => b.score - a.score || a.date.localeCompare(b.date) || a.start.localeCompare(b.start),
  );

  const blocks: SharedBlock[] = [];
  for (const candidate of pool) {
    if (blocks.length >= 3) break;
    if (blocks.some((block) => blocksConflict(block, candidate))) continue;
    blocks.push({
      date: candidate.date,
      start: candidate.start,
      end: candidate.end,
      people: candidate.people,
      slotCount: candidate.slotCount,
    });
  }

  const max = cells.reduce((highest, row) => {
    const rowMax = row.reduce((inner, cell) => Math.max(inner, cell.people.length), 0);
    return Math.max(highest, rowMax);
  }, 0);

  return { dates, slotStarts, cells, max, blocks };
}

export function findCell(model: OverlapModel, date: string, start: string): { r: number; c: number } | null {
  const r = model.dates.indexOf(date);
  const c = model.slotStarts.indexOf(start);
  if (r < 0 || c < 0) return null;
  return { r, c };
}

export function heatStep(count: number, max: number): 0 | 1 | 2 | 3 | 4 | 5 {
  if (count <= 0 || max <= 0) return 0;
  const ratio = count / max;
  if (ratio <= 0.2) return 1;
  if (ratio <= 0.4) return 2;
  if (ratio <= 0.6) return 3;
  if (ratio <= 0.8) return 4;
  return 5;
}

export function areaPull(
  event: Gathering,
  volunteers: Volunteer[],
  statusOf: (taskId: string) => TaskStatus,
): { areas: AreaPull[]; flexible: PersonRef[] } {
  const areas: AreaPull[] = event.areas.map((area) => ({
    areaId: area.id,
    name: area.name,
    blurb: area.blurb,
    place: area.place,
    count: 0,
    people: [],
    tasks: event.tasks
      .filter((task) => task.areaId === area.id && statusOf(task.id) === "open")
      .map((task) => ({
        taskId: task.id,
        title: task.title,
        count: 0,
        people: [] as PersonRef[],
      })),
  }));

  const taskLocate = new Map<string, { area: AreaPull; task: TaskPull }>();
  for (const area of areas) {
    for (const task of area.tasks) taskLocate.set(task.taskId, { area, task });
  }

  const flexible: PersonRef[] = [];
  for (const volunteer of volunteers) {
    const person = toPerson(volunteer);
    if (volunteer.flexible) flexible.push(person);
    const seen = new Set<string>();
    for (const taskId of volunteer.taskIds) {
      const located = taskLocate.get(taskId);
      if (!located) continue;
      if (!located.task.people.some((existing) => existing.id === person.id)) {
        located.task.people.push(person);
        located.task.count += 1;
      }
      if (!seen.has(located.area.areaId)) {
        seen.add(located.area.areaId);
        located.area.people.push(person);
        located.area.count += 1;
      }
    }
  }

  return { areas, flexible };
}

export function peopleWord(count: number): string {
  return count === 1 ? "1 person" : `${count} people`;
}

export function blockPhrase(people: PersonRef[]): string {
  const examples = people.filter((person) => person.example).length;
  const real = people.length - examples;
  if (people.length === 0) return "No one is free for a shared block yet.";
  if (real === 0) {
    return `${examples} example ${examples === 1 ? "person shares" : "people share"} this whole block`;
  }
  if (examples === 0) {
    return `${real} ${real === 1 ? "person shares" : "people share"} this whole block`;
  }
  const realWord = real === 1 ? "1 person" : `${real} people`;
  const exampleWord = examples === 1 ? "1 example" : `${examples} examples`;
  return `${realWord} and ${exampleWord} share this whole block`;
}
