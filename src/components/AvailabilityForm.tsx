import { useMemo, useRef, useState, type FormEvent } from "react";
import type { Area, Gathering, Task, TimeRange } from "../types";
import {
  eachGatheringDate,
  eachSlotStart,
  formatDayNum,
  formatMonthDay,
  formatRange,
  formatTime,
  formatWeekdayShort,
  groupWeeks,
  mergeRanges,
  minutes,
  timePresets,
  weekdayIndex,
} from "../lib/time";

type Draft = {
  name: string;
  note: string;
  ranges: TimeRange[];
  taskIds: string[];
  flexible: boolean;
};

type FieldError = { id: string; message: string };

export function AvailabilityForm({
  event,
  areas,
  tasks,
  onSubmit,
}: {
  event: Gathering;
  areas: Area[];
  tasks: Task[];
  onSubmit: (draft: Draft) => void;
}) {
  const dates = useMemo(
    () => eachGatheringDate(event.windowStart, event.windowEnd),
    [event.windowStart, event.windowEnd],
  );
  const weeks = useMemo(() => groupWeeks(dates), [dates]);
  const presets = useMemo(() => timePresets(event.dayStart, event.dayEnd), [event.dayStart, event.dayEnd]);
  const startOptions = useMemo(() => eachSlotStart(event.dayStart, event.dayEnd), [event.dayStart, event.dayEnd]);
  const endOptions = useMemo(() => [...startOptions.slice(1), event.dayEnd], [startOptions, event.dayEnd]);

  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [ranges, setRanges] = useState<TimeRange[]>([]);
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [flexible, setFlexible] = useState(false);
  const [customStart, setCustomStart] = useState(event.dayStart);
  const [customEnd, setCustomEnd] = useState(presets[0]?.end ?? event.dayEnd);
  const [customOpen, setCustomOpen] = useState(false);
  const [hint, setHint] = useState("");
  const [errors, setErrors] = useState<FieldError[]>([]);
  const errorRef = useRef<HTMLDivElement>(null);

  const tasksByArea = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      const list = map.get(task.areaId) ?? [];
      list.push(task);
      map.set(task.areaId, list);
    }
    return map;
  }, [tasks]);

  function toggleDay(date: string) {
    setHint("");
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }

  function toggleWeekday(day: number) {
    const matching = dates.filter((date) => weekdayIndex(date) === day);
    setSelected((current) => {
      const next = new Set(current);
      const allOn = matching.every((date) => next.has(date));
      for (const date of matching) {
        if (allOn) next.delete(date);
        else next.add(date);
      }
      return next;
    });
    setHint("");
  }

  function addHours(start: string, end: string) {
    if (selected.size === 0) {
      setHint("Choose at least one day first.");
      return;
    }
    if (minutes(end) <= minutes(start)) {
      setHint("The end time needs to be later than the start.");
      return;
    }
    const added: TimeRange[] = [...selected].map((date) => ({ date, start, end }));
    setRanges((current) => mergeRanges([...current, ...added]));
    setSelected(new Set());
    setHint("");
  }

  function toggleTask(id: string) {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleArea(areaId: string) {
    const ids = (tasksByArea.get(areaId) ?? []).map((task) => task.id);
    setPicked((current) => {
      const next = new Set(current);
      const allOn = ids.length > 0 && ids.every((id) => next.has(id));
      for (const id of ids) {
        if (allOn) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }

  function submit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const next: FieldError[] = [];
    if (!name.trim()) next.push({ id: "join-name", message: "Add your name so people know who is coming." });
    if (ranges.length === 0) next.push({ id: "day-picker", message: "Add at least one day and a time you can come." });
    if (selected.size > 0) {
      next.push({
        id: "day-picker",
        message: "Those highlighted days are not added yet. Choose a time, or clear the days.",
      });
    }
    setErrors(next);
    if (next.length > 0) {
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    onSubmit({
      name: name.trim(),
      note: note.trim(),
      ranges,
      taskIds: [...picked],
      flexible,
    });
  }

  const placeNoun = event.mode === "meet" ? "places" : "areas";

  return (
    <form className="join" id="join" onSubmit={submit} noValidate>
      <div className="section-head">
        <p className="index">{event.mode === "work" ? "04" : "03"}</p>
        <h2>Share your hours</h2>
        <p>
          No account. Add your name, the days you can come, and the {placeNoun} you can help with. A refresh on this
          device keeps what you enter.
        </p>
      </div>

      {errors.length > 0 && (
        <div className="form-errors" role="alert" tabIndex={-1} ref={errorRef}>
          <p>Please fix the following:</p>
          <ul>
            {errors.map((error) => (
              <li key={error.message}>
                <a href={`#${error.id}`}>{error.message}</a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="field">
        <label htmlFor="join-name">Your name</label>
        <input
          id="join-name"
          name="name"
          autoComplete="name"
          maxLength={60}
          value={name}
          aria-invalid={errors.some((error) => error.id === "join-name")}
          onChange={(change) => setName(change.target.value)}
        />
      </div>

      <fieldset className="field" id="day-picker">
        <legend>When you can come</legend>
        <p className="field-help" id="day-help">
          Tap a day, then choose a time. Sundays are left off. You can add more than one stretch.
        </p>
        <div className="day-shortcuts">
          <button type="button" onClick={() => toggleWeekday(6)}>
            All Saturdays
          </button>
          <button type="button" onClick={() => setSelected(new Set())}>
            Clear days
          </button>
        </div>
        {weeks.map((week) => (
          <div key={week[0]} className="week">
            <p className="week-label">
              {formatMonthDay(week[0])}
              {week.length > 1 ? ` – ${formatMonthDay(week[week.length - 1])}` : ""}
            </p>
            <div className="days" role="group" aria-describedby="day-help">
              {week.map((date) => (
                <button
                  key={date}
                  type="button"
                  className="day"
                  aria-pressed={selected.has(date)}
                  onClick={() => toggleDay(date)}
                >
                  <span className="day-wd">{formatWeekdayShort(date)}</span>
                  <span className="day-num">{formatDayNum(date)}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className="presets">
          {presets.map((preset) => (
            <button key={preset.id} type="button" className="preset" onClick={() => addHours(preset.start, preset.end)}>
              <span className="preset-name">{preset.label}</span>
              <span className="preset-time">
                {formatTime(preset.start)} – {formatTime(preset.end)}
              </span>
            </button>
          ))}
        </div>
        <div className="custom-hours">
          <button
            type="button"
            className="text-btn"
            aria-expanded={customOpen}
            onClick={() => setCustomOpen((open) => !open)}
          >
            {customOpen ? "Hide other hours" : "Other hours"}
          </button>
          {customOpen && (
            <div className="custom-grid">
              <label>
                Start
                <select value={customStart} onChange={(change) => setCustomStart(change.target.value)}>
                  {startOptions.map((option) => (
                    <option key={option} value={option}>
                      {formatTime(option)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                End
                <select value={customEnd} onChange={(change) => setCustomEnd(change.target.value)}>
                  {endOptions.map((option) => (
                    <option key={option} value={option}>
                      {formatTime(option)}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="btn btn-ghost" onClick={() => addHours(customStart, customEnd)}>
                Add these hours
              </button>
            </div>
          )}
        </div>
        {hint && (
          <p className="field-error" role="status">
            {hint}
          </p>
        )}
        {ranges.length > 0 && (
          <ul className="added-ranges">
            {ranges.map((range) => (
              <li key={`${range.date}-${range.start}-${range.end}`}>
                <span>{formatRange(range)}</span>
                <button
                  type="button"
                  className="text-btn"
                  onClick={() =>
                    setRanges((current) =>
                      current.filter(
                        (item) => !(item.date === range.date && item.start === range.start && item.end === range.end),
                      ),
                    )
                  }
                >
                  Remove
                  <span className="sr-only"> {formatRange(range)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      <fieldset className="field">
        <legend>{event.mode === "meet" ? "Where would you like to meet?" : "Where can you help?"}</legend>
        <p className="field-help">
          {event.mode === "meet"
            ? "Choose any rooms that suit you. Hours alone are enough if you are glad to meet wherever the group lands."
            : "Choose a whole area, or uncheck a task you would rather leave. Hours alone are enough if you can help wherever you are needed."}
        </p>
        <label className="check-line">
          <input type="checkbox" checked={flexible} onChange={(change) => setFlexible(change.target.checked)} />
          <span>{event.mode === "meet" ? "I am glad to meet wherever the group lands" : "I can help wherever I am needed"}</span>
        </label>
        <div className={event.mode === "meet" ? "choice-grid" : "choice-stack"}>
          {areas.map((area) => {
            const areaTasks = tasksByArea.get(area.id) ?? [];
            if (areaTasks.length === 0) return null;
            const ids = areaTasks.map((task) => task.id);
            const selectedCount = ids.filter((id) => picked.has(id)).length;
            const allOn = selectedCount === ids.length;
            const some = selectedCount > 0 && !allOn;
            return (
              <div key={area.id} className="choice-card">
                <label className="area-check">
                  <input
                    type="checkbox"
                    checked={allOn}
                    ref={(element) => {
                      if (element) element.indeterminate = some;
                    }}
                    onChange={() => toggleArea(area.id)}
                  />
                  <span>
                    <strong>{area.name}</strong>
                    {area.blurb && <small>{area.blurb}</small>}
                  </span>
                </label>
                {event.mode === "work" && (
                  <ul className="choice-tasks">
                    {areaTasks.map((task) => (
                      <li key={task.id}>
                        <label>
                          <input
                            type="checkbox"
                            checked={picked.has(task.id)}
                            onChange={() => toggleTask(task.id)}
                          />
                          <span>
                            {task.title}
                            {task.heft === "heavier" && <span className="heft">Heavier lift</span>}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </fieldset>

      <div className="field">
        <label htmlFor="join-note">Anything helpful, if you want</label>
        <textarea
          id="join-note"
          maxLength={240}
          value={note}
          placeholder="I can bring loppers. I need to leave by noon."
          onChange={(change) => setNote(change.target.value)}
        />
      </div>

      <div className="join-submit">
        <button type="submit" className="btn btn-primary">
          Share my hours
        </button>
        <p>
          {ranges.length === 0 ? "No hours added yet." : `${ranges.length} ${ranges.length === 1 ? "block" : "blocks"} of time`}
          {picked.size > 0 ? ` · ${picked.size} ${picked.size === 1 ? "task" : "tasks"}` : ""}
        </p>
      </div>
    </form>
  );
}
