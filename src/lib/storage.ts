import type { Area, Gathering, Store, Task, TaskStatus, TimeRange, Volunteer } from "../types";
import { dateSpanDays, isHHMM, isISODate, minutes } from "./time";

export const STORAGE_KEY = "grace.store.v1";

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export function emptyStore(): Store {
  return {
    version: 1,
    volunteersByEvent: {},
    removedIds: [],
    examplesHidden: {},
    taskStatus: {},
    customEvents: [],
  };
}

function isTimeRange(value: unknown): value is TimeRange {
  if (!value || typeof value !== "object") return false;
  const range = value as TimeRange;
  if (!isISODate(range.date) || !isHHMM(range.start) || !isHHMM(range.end)) return false;
  return minutes(range.end) > minutes(range.start);
}

function sanitizeVolunteer(value: unknown): Volunteer | null {
  if (!value || typeof value !== "object") return null;
  const volunteer = value as Partial<Volunteer>;
  if (typeof volunteer.id !== "string" || typeof volunteer.name !== "string") return null;
  if (!Array.isArray(volunteer.ranges)) return null;
  const ranges = volunteer.ranges.filter(isTimeRange).slice(0, 40);
  const name = volunteer.name.trim().slice(0, 60);
  if (!name || ranges.length === 0) return null;
  return {
    id: volunteer.id.slice(0, 80),
    name,
    note: typeof volunteer.note === "string" ? volunteer.note.slice(0, 240) : "",
    ranges,
    taskIds: Array.isArray(volunteer.taskIds)
      ? volunteer.taskIds.filter((id): id is string => typeof id === "string").slice(0, 80)
      : [],
    flexible: Boolean(volunteer.flexible),
    example: false,
    createdAt: typeof volunteer.createdAt === "string" ? volunteer.createdAt : new Date(0).toISOString(),
  };
}

function isArea(value: unknown): value is Area {
  if (!value || typeof value !== "object") return false;
  const area = value as Area;
  return typeof area.id === "string" && typeof area.name === "string" && area.name.trim().length > 0;
}

function isTask(value: unknown): value is Task {
  if (!value || typeof value !== "object") return false;
  const task = value as Task;
  return (
    typeof task.id === "string" &&
    typeof task.areaId === "string" &&
    typeof task.title === "string" &&
    task.title.trim().length > 0 &&
    (task.heft === "heavier" || task.heft === "gentler" || task.heft === "either")
  );
}

const RESERVED_IDS = new Set(["before-the-frost", "winter-welcome"]);

function sanitizeGathering(value: unknown): Gathering | null {
  if (!value || typeof value !== "object") return null;
  const gathering = value as Partial<Gathering>;
  if (typeof gathering.id !== "string" || typeof gathering.title !== "string") return null;
  if (RESERVED_IDS.has(gathering.id)) return null;
  const title = gathering.title.trim().slice(0, 80);
  if (!title) return null;
  if (!isISODate(gathering.windowStart ?? "") || !isISODate(gathering.windowEnd ?? "")) return null;
  if ((gathering.windowStart ?? "") > (gathering.windowEnd ?? "")) return null;
  if (dateSpanDays(gathering.windowStart as string, gathering.windowEnd as string) > 45) return null;
  if (!isHHMM(gathering.dayStart ?? "") || !isHHMM(gathering.dayEnd ?? "")) return null;
  if (minutes(gathering.dayEnd as string) - minutes(gathering.dayStart as string) < 60) return null;

  const areas = (Array.isArray(gathering.areas) ? gathering.areas.filter(isArea) : [])
    .slice(0, 24)
    .map((area) => ({
      id: area.id.slice(0, 80),
      name: area.name.trim().slice(0, 60),
      blurb: typeof area.blurb === "string" ? area.blurb.slice(0, 180) : "",
    }));
  const areaIds = new Set(areas.map((area) => area.id));
  const tasks = (Array.isArray(gathering.tasks) ? gathering.tasks.filter(isTask) : [])
    .filter((task) => areaIds.has(task.areaId))
    .slice(0, 80)
    .map((task) => ({
      id: task.id.slice(0, 80),
      areaId: task.areaId,
      title: task.title.trim().slice(0, 120),
      heft: task.heft,
    }));
  if (areas.length === 0 || tasks.length === 0) return null;

  const mode = gathering.mode === "meet" ? "meet" : "work";
  return {
    id: gathering.id.slice(0, 80),
    title,
    kicker: typeof gathering.kicker === "string" ? gathering.kicker.slice(0, 60) : "On this device",
    summary: typeof gathering.summary === "string" ? gathering.summary.slice(0, 240) : "",
    story: Array.isArray(gathering.story)
      ? gathering.story.filter((part): part is string => typeof part === "string").slice(0, 8).map((part) => part.slice(0, 600))
      : [],
    notes: Array.isArray(gathering.notes)
      ? gathering.notes.filter((part): part is string => typeof part === "string").slice(0, 6).map((part) => part.slice(0, 400))
      : [],
    featured: false,
    sample: false,
    mode,
    sketch: "none",
    season: "neutral",
    windowStart: gathering.windowStart as string,
    windowEnd: gathering.windowEnd as string,
    dayStart: gathering.dayStart as string,
    dayEnd: gathering.dayEnd as string,
    areas,
    tasks,
    volunteers: [],
    createdAt: typeof gathering.createdAt === "string" ? gathering.createdAt : undefined,
  };
}

function isStatus(value: unknown): value is TaskStatus {
  return value === "open" || value === "done" || value === "later";
}

export function sanitizeStore(value: unknown): Store {
  const store = emptyStore();
  if (!value || typeof value !== "object") return store;
  const raw = value as Partial<Store>;
  if (raw.version !== 1) return store;

  if (raw.volunteersByEvent && typeof raw.volunteersByEvent === "object") {
    for (const [eventId, list] of Object.entries(raw.volunteersByEvent)) {
      if (!Array.isArray(list)) continue;
      const volunteers = list.map(sanitizeVolunteer).filter((item): item is Volunteer => item !== null).slice(0, 200);
      if (volunteers.length > 0) store.volunteersByEvent[eventId.slice(0, 80)] = volunteers;
    }
  }

  if (Array.isArray(raw.removedIds)) {
    store.removedIds = raw.removedIds.filter((id): id is string => typeof id === "string").slice(0, 500);
  }

  if (raw.examplesHidden && typeof raw.examplesHidden === "object") {
    for (const [eventId, hidden] of Object.entries(raw.examplesHidden)) {
      if (hidden === true) store.examplesHidden[eventId.slice(0, 80)] = true;
    }
  }

  if (raw.taskStatus && typeof raw.taskStatus === "object") {
    for (const [eventId, statuses] of Object.entries(raw.taskStatus)) {
      if (!statuses || typeof statuses !== "object") continue;
      const clean: Record<string, TaskStatus> = {};
      for (const [taskId, status] of Object.entries(statuses)) {
        if (isStatus(status) && status !== "open") clean[taskId.slice(0, 80)] = status;
      }
      if (Object.keys(clean).length > 0) store.taskStatus[eventId.slice(0, 80)] = clean;
    }
  }

  if (Array.isArray(raw.customEvents)) {
    store.customEvents = raw.customEvents
      .map(sanitizeGathering)
      .filter((event): event is Gathering => event !== null)
      .slice(0, 30);
  }

  return store;
}

export function loadStore(storage: StorageLike | null): Store {
  if (!storage) return emptyStore();
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    return sanitizeStore(JSON.parse(raw) as unknown);
  } catch {
    return emptyStore();
  }
}

export function saveStore(store: Store, storage: StorageLike | null): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

export function browserStorage(): StorageLike | null {
  try {
    const probe = "__grace__";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return null;
  }
}
