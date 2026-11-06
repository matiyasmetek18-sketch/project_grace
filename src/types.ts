export type Heft = "heavier" | "gentler" | "either";

export type TaskStatus = "open" | "done" | "later";

export type GatheringMode = "work" | "meet";

export type Sketch = "grounds" | "rooms" | "none";

export type Season = "autumn" | "winter" | "neutral";

export type TimeRange = {
  date: string;
  start: string;
  end: string;
};

export type Volunteer = {
  id: string;
  name: string;
  note: string;
  ranges: TimeRange[];
  taskIds: string[];
  flexible: boolean;
  example: boolean;
  createdAt: string;
};

export type Task = {
  id: string;
  areaId: string;
  title: string;
  heft: Heft;
};

export type Area = {
  id: string;
  name: string;
  blurb: string;
  /** Named region on the grounds sketch. Omitted for gatherings without a map. */
  place?: string;
};

export type Gathering = {
  id: string;
  title: string;
  kicker: string;
  summary: string;
  story: string[];
  notes: string[];
  featured: boolean;
  sample: boolean;
  mode: GatheringMode;
  sketch: Sketch;
  season: Season;
  windowStart: string;
  windowEnd: string;
  dayStart: string;
  dayEnd: string;
  areas: Area[];
  tasks: Task[];
  /** Seeded example people. Hours added in the browser live in local storage. */
  volunteers: Volunteer[];
  createdAt?: string;
};

export type Store = {
  version: 1;
  volunteersByEvent: Record<string, Volunteer[]>;
  removedIds: string[];
  examplesHidden: Record<string, boolean>;
  taskStatus: Record<string, Record<string, TaskStatus>>;
  customEvents: Gathering[];
};
