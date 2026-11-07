import { useMemo, useRef, useState, type FormEvent } from "react";
import type { TimeRange } from "../types";
import { loadEntries, saveEntries, type AvailabilityEntry } from "../lib/availabilityStore";
import { uid } from "../lib/id";
import {
  dayOrderMessage,
  eachGatheringDate,
  formatDayNum,
  formatFullDate,
  formatMonthDay,
  formatRange,
  formatTime,
  formatWeekdayShort,
  groupWeeks,
  halfHours,
  isISODate,
  mergeRanges,
  minutes,
  weekdayIndex,
} from "../lib/time";
import { useDocumentTitle } from "../useDocumentTitle";

const DAY_START = "07:00";
const DAY_END = "21:00";

const PRESETS = [
  { id: "morning", label: "Morning", start: "08:00", end: "12:00" },
  { id: "afternoon", label: "Afternoon", start: "12:00", end: "16:00" },
  { id: "evening", label: "Evening", start: "16:00", end: "20:00" },
];

function initialWindow(): { start: string; end: string } {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (start.getDay() === 0) start.setDate(start.getDate() + 1);
  const end = new Date(start);
  end.setDate(end.getDate() + 20);
  if (end.getDay() === 0) end.setDate(end.getDate() - 1);
  const toIso = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return { start: toIso(start), end: toIso(end) };
}

export function AvailabilityPage() {
  useDocumentTitle("Grace — when you can come");
  const window0 = useMemo(() => initialWindow(), []);
  const [entries, setEntries] = useState<AvailabilityEntry[]>(() => loadEntries());
  const [saveError, setSaveError] = useState(false);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [first, setFirst] = useState(window0.start);
  const [last, setLast] = useState(window0.end);
  const [firstDraft, setFirstDraft] = useState(window0.start);
  const [lastDraft, setLastDraft] = useState(window0.end);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [ranges, setRanges] = useState<TimeRange[]>([]);
  const [customStart, setCustomStart] = useState("09:00");
  const [customEnd, setCustomEnd] = useState("11:00");
  const [hint, setHint] = useState("");
  const [formError, setFormError] = useState("");
  const [thanks, setThanks] = useState("");
  const errorRef = useRef<HTMLParagraphElement>(null);

  const dates = useMemo(() => eachGatheringDate(first, last), [first, last]);
  const weeks = useMemo(() => groupWeeks(dates), [dates]);
  const startOptions = useMemo(() => halfHours(DAY_START, "20:30"), []);
  const endOptions = useMemo(() => halfHours("07:30", DAY_END), []);
  const timeError = minutes(customEnd) <= minutes(customStart);

  function applyFirst(value: string) {
    setFirstDraft(value);
    const message = dayOrderMessage(value, lastDraft);
    if (message && isISODate(value) && isISODate(lastDraft) && value > lastDraft) {
      setOrderError(message);
      return;
    }
    if (!isISODate(value)) {
      setOrderError("Choose a real first day.");
      return;
    }
    setOrderError(null);
    setFirst(value);
    setSelected(new Set());
  }

  function applyLast(value: string) {
    setLastDraft(value);
    const message = dayOrderMessage(firstDraft, value);
    if (message) {
      setOrderError(message);
      return;
    }
    setOrderError(null);
    setLast(value);
    setSelected(new Set());
  }

  function toggleDay(date: string) {
    setHint("");
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }

  function toggleSaturdays() {
    const saturdays = dates.filter((date) => weekdayIndex(date) === 6);
    setSelected((current) => {
      const next = new Set(current);
      const allOn = saturdays.length > 0 && saturdays.every((date) => next.has(date));
      for (const date of saturdays) {
        if (allOn) next.delete(date);
        else next.add(date);
      }
      return next;
    });
  }

  function addHours(start: string, end: string) {
    if (selected.size === 0) {
      setHint("Choose at least one day first.");
      return;
    }
    if (minutes(end) <= minutes(start)) {
      setHint("The end needs to be later than the start.");
      return;
    }
    const added = [...selected].map((date) => ({ date, start, end }));
    setRanges((current) => mergeRanges([...current, ...added]));
    setSelected(new Set());
    setHint("");
    setFormError("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (orderError) {
      setFormError(orderError);
      errorRef.current?.focus();
      return;
    }
    if (!name.trim()) {
      setFormError("Add your name so people know who can come.");
      errorRef.current?.focus();
      return;
    }
    if (selected.size > 0) {
      setFormError("Those highlighted days are not added yet. Choose a time, or clear the days.");
      errorRef.current?.focus();
      return;
    }
    if (ranges.length === 0) {
      setFormError("Add at least one day and a time. It can be as short as you like.");
      errorRef.current?.focus();
      return;
    }
    const entry: AvailabilityEntry = {
      id: uid("person"),
      name: name.trim().slice(0, 60),
      note: note.trim().slice(0, 240),
      ranges,
      createdAt: new Date().toISOString(),
    };
    const next = [entry, ...entries];
    setEntries(next);
    setSaveError(!saveEntries(next));
    setThanks(entry.name);
    setName("");
    setNote("");
    setRanges([]);
    setFormError("");
  }

  return (
    <div className="collector wrap">
      <header className="collector-intro">
        <p className="eyebrow">Availability</p>
        <h1>When can you come?</h1>
        <p className="lede">
          Add your name and the times you can be there. You do not have to stay for any set number of hours. Come and
          go as you like.
        </p>
      </header>

      <form className="collector-card" onSubmit={submit} noValidate>
        {formError && (
          <p className="form-errors" role="alert" tabIndex={-1} ref={errorRef}>
            {formError}
          </p>
        )}
        {thanks && (
          <p className="banner" role="status">
            Thank you, {thanks}. Your times are saved in this browser.
          </p>
        )}
        {saveError && (
          <p className="banner banner-warn" role="status">
            This browser did not keep the latest change. It will last until you close the page.
          </p>
        )}

        <div className="field">
          <label htmlFor="avail-name">Your name</label>
          <input
            id="avail-name"
            name="name"
            autoComplete="name"
            maxLength={60}
            value={name}
            onChange={(change) => setName(change.target.value)}
          />
        </div>

        <fieldset className="field">
          <legend>Which days to show</legend>
          <div className="split">
            <div className="field">
              <label htmlFor="first-day">First day</label>
              <input
                id="first-day"
                type="date"
                value={firstDraft}
                max={isISODate(last) ? last : undefined}
                aria-invalid={Boolean(orderError)}
                aria-describedby={orderError ? "day-order-error" : undefined}
                onChange={(change) => applyFirst(change.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="last-day">Last day</label>
              <input
                id="last-day"
                type="date"
                value={lastDraft}
                min={isISODate(first) ? first : undefined}
                aria-invalid={Boolean(orderError)}
                aria-describedby={orderError ? "day-order-error" : undefined}
                onChange={(change) => applyLast(change.target.value)}
              />
            </div>
          </div>
          {orderError && (
            <p id="day-order-error" className="field-error" role="alert">
              {orderError}
            </p>
          )}
        </fieldset>

        <fieldset className="field" id="day-picker">
          <legend>When you can come</legend>
          <p className="field-help" id="day-help">
            Tap the days you might come. Then add a time. A short visit is enough, and you can add more than one.
          </p>
          <ul className="calendar-legend" aria-label="Calendar key">
            <li>
              <span className="day day-key" aria-hidden="true">
                <span className="day-wd">Day</span>
                <span className="day-num">1</span>
              </span>
              <span>Open. Tap to choose it.</span>
            </li>
            <li>
              <span className="day day-key is-on" aria-hidden="true">
                <span className="day-wd">Day</span>
                <span className="day-num">1</span>
              </span>
              <span>Selected. Tap again to clear it.</span>
            </li>
            <li>
              <span className="legend-note">Sundays are not listed.</span>
            </li>
          </ul>
          <div className="day-shortcuts">
            <button type="button" onClick={toggleSaturdays}>
              All Saturdays
            </button>
            <button type="button" onClick={() => setSelected(new Set())}>
              Clear days
            </button>
          </div>
          {dates.length === 0 ? (
            <p>No open days in this stretch. Move the last day later than the first.</p>
          ) : (
            weeks.map((week) => (
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
            ))
          )}

          <div className="hours-board">
            <h2>Hours</h2>
            <p>These are suggestions, not a promise to stay. Come and go as you like.</p>
            <div className="presets">
              {PRESETS.map((preset) => (
                <button key={preset.id} type="button" className="preset" onClick={() => addHours(preset.start, preset.end)}>
                  <span className="preset-name">{preset.label}</span>
                  <span className="preset-time">
                    {formatTime(preset.start)} – {formatTime(preset.end)}
                  </span>
                </button>
              ))}
            </div>

            <div className="own-hours">
              <h3>Your own hours</h3>
              <p>Set any start and end. A half hour is fine. Then add them to the days you tapped.</p>
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
                  <select
                    value={customEnd}
                    aria-invalid={timeError}
                    onChange={(change) => setCustomEnd(change.target.value)}
                  >
                    {endOptions.map((option) => (
                      <option key={option} value={option}>
                        {formatTime(option)}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" className="btn" onClick={() => addHours(customStart, customEnd)}>
                  Add these hours
                </button>
              </div>
              {timeError && <p className="field-error">The end needs to be later than the start.</p>}
            </div>
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

        <div className="field">
          <label htmlFor="avail-note">A short note, if you want</label>
          <textarea
            id="avail-note"
            maxLength={240}
            value={note}
            placeholder="I may only stay an hour. I can come after lunch."
            onChange={(change) => setNote(change.target.value)}
          />
        </div>

        <div className="join-submit">
          <button type="submit" className="btn btn-primary">
            Share when I can come
          </button>
          <p>{ranges.length === 0 ? "No times added yet." : `${ranges.length} time ${ranges.length === 1 ? "block" : "blocks"} ready`}</p>
        </div>
      </form>

      <section className="saved" aria-labelledby="saved-title">
        <h2 id="saved-title">Saved on this device</h2>
        {entries.length === 0 ? (
          <p>No one has added times in this browser yet.</p>
        ) : (
          <ul className="saved-list">
            {entries.map((entry) => (
              <li key={entry.id}>
                <h3>{entry.name}</h3>
                {entry.note && <p>{entry.note}</p>}
                <ul>
                  {entry.ranges.map((range) => (
                    <li key={`${entry.id}-${range.date}-${range.start}`}>{formatFullDate(range.date)} · {formatTime(range.start)} – {formatTime(range.end)}</li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="text-btn"
                  onClick={() => {
                    const next = entries.filter((item) => item.id !== entry.id);
                    setEntries(next);
                    setSaveError(!saveEntries(next));
                  }}
                >
                  Remove {entry.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
