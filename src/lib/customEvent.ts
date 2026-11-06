import type { Area, Gathering, GatheringMode, Task } from "../types";
import { dateSpanDays, isHHMM, isISODate, minutes } from "./time";

export type CustomEventInput = {
  title: string;
  summary: string;
  story: string;
  mode: GatheringMode;
  windowStart: string;
  windowEnd: string;
  dayStart: string;
  dayEnd: string;
  areas: { name: string; tasks: string }[];
};

export type FieldError = { id: string; message: string };

export function validateCustomEvent(input: CustomEventInput): FieldError[] {
  const errors: FieldError[] = [];
  const title = input.title.trim();
  if (!title) errors.push({ id: "event-title", message: "Give the gathering a name." });
  else if (title.length > 80) errors.push({ id: "event-title", message: "Use 80 characters or fewer for the name." });

  if (!input.summary.trim()) {
    errors.push({ id: "event-summary", message: "Add a sentence about what this gathering is." });
  }

  if (!isISODate(input.windowStart) || !isISODate(input.windowEnd) || input.windowStart > input.windowEnd) {
    errors.push({
      id: "event-start",
      message: "Choose a first day and a last day, with the last day on or after the first.",
    });
  } else if (dateSpanDays(input.windowStart, input.windowEnd) > 45) {
    errors.push({ id: "event-start", message: "Keep the window to 45 days or fewer so the chart stays readable." });
  }

  if (!isHHMM(input.dayStart) || !isHHMM(input.dayEnd) || minutes(input.dayEnd) - minutes(input.dayStart) < 60) {
    errors.push({ id: "event-hours-start", message: "Choose an end time at least an hour after the start." });
  }

  if (!input.areas.some((area) => area.name.trim())) {
    errors.push({
      id: "areas-fieldset",
      message: input.mode === "meet" ? "Add at least one place to meet." : "Add at least one area of work.",
    });
  }

  return errors;
}

export function buildCustomGathering(input: CustomEventInput, id: string, createdAt: string): Gathering {
  const areas: Area[] = [];
  const tasks: Task[] = [];
  input.areas.forEach((row, index) => {
    const name = row.name.trim();
    if (!name) return;
    const areaId = `${id}-area-${index}`;
    areas.push({ id: areaId, name: name.slice(0, 60), blurb: "" });
    const lines =
      input.mode === "meet" ? [name] : row.tasks.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    const titles = (lines.length > 0 ? lines : [name]).slice(0, 20);
    titles.forEach((title, taskIndex) => {
      tasks.push({
        id: `${id}-task-${index}-${taskIndex}`,
        areaId,
        title: title.slice(0, 120),
        heft: "either",
      });
    });
  });

  const story = input.story.trim()
    ? input.story
        .trim()
        .split(/\n\s*\n/)
        .map((part) => part.trim())
        .filter(Boolean)
        .slice(0, 6)
    : [input.summary.trim()];

  return {
    id,
    title: input.title.trim().slice(0, 80),
    kicker: input.mode === "meet" ? "On this device · meet-up" : "On this device · work day",
    summary: input.summary.trim().slice(0, 240),
    story: story.map((part) => part.slice(0, 600)),
    notes: ["Added in this browser. Hours shared here stay on this device."],
    featured: false,
    sample: false,
    mode: input.mode,
    sketch: "none",
    season: "neutral",
    windowStart: input.windowStart,
    windowEnd: input.windowEnd,
    dayStart: input.dayStart,
    dayEnd: input.dayEnd,
    areas,
    tasks,
    volunteers: [],
    createdAt,
  };
}
