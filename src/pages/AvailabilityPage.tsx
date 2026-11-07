import { useMemo, useRef, useState, type FormEvent } from "react";
import type { TimeRange } from "../types";
import { loadEntries, saveEntries, type AvailabilityEntry } from "../lib/availabilityStore";
import { uid } from "../lib/id";
import {
  dayChoiceMessage,
  formatDayNum,
  formatFullDate,
  formatISODate,
  formatRange,
  formatTime,
  formatWeekdayShort,
  halfHours,
  mergeRanges,
  minutes,
} from "../lib/time";
import { useDocumentTitle } from "../useDocumentTitle";

const DAY_START = "07:00";
const DAY_END = "21:00";

const PRESETS = [
  { id: "morning", label: "Morning", start: "08:00", end: "12:00" },
  { id: "afternoon", label: "Afternoon", start: "12:00", end: "16:00" },
  { id: "evening", label: "Evening", start: "16:00", end: "20:00" },
];

function nextOpenDay(today = new Date()): string {
  const date = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  while (date.getDay() === 0 || date.getDay() === 4) date.setDate(date.getDate() + 1);
  return formatISODate(date);
}

function copyHoursOnto(date: string, ranges: TimeRange[]): TimeRange[] {
  const pairs = new Map<string, { start: string; end: string }>();
  for (const range of ranges) pairs.set(`${range.start}-${range.end}`, { start: range.start, end: range.end });
  const added = [...pairs.values()].map((pair) => ({ date, ...pair }));
  return mergeRanges([...ranges, ...added]);
}

export function AvailabilityPage() {
  useDocumentTitle("Grace — when you can come");
  const suggested = useMemo(() => nextOpenDay(), []);
  const [entries, setEntries] = useState<AvailabilityEntry[]>(() => loadEntries());
  const [saveError, setSaveError] = useState(false);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [days, setDays] = useState<string[]>([]);
  const [dayDraft, setDayDraft] = useState(suggested);
  const [extraDraft, setExtraDraft] = useState("");
  const [dayError, setDayError] = useState("");
  const [ranges, setRanges] = useState<TimeRange[]>([]);
  const [customStart, setCustomStart] = useState("09:00");
  const [customEnd, setCustomEnd] = useState("11:00");
  const [hint, setHint] = useState("");
  const [formError, setFormError] = useState("");
  const [thanks, setThanks] = useState("");
  const errorRef = useRef<HTMLParagraphElement>(null);

  const startOptions = useMemo(() => halfHours(DAY_START, "20:30"), []);
  const endOptions = useMemo(() => halfHours("07:30", DAY_END), []);
  const timeError = minutes(customEnd) <= minutes(customStart);
  const orderedDays = [...days].sort();

  function addDay(value: string) {
    const message = dayChoiceMessage(value, days);
    if (message) {
      setDayError(message);
      return;
    }
    setDays((current) => [...current, value]);
    setRanges((current) => copyHoursOnto(value, current));
    setDayError("");
    setHint("");
    setFormError("");
    setExtraDraft("");
  }

  function removeDay(date: string) {
    setDays((current) => current.filter((item) => item !== date));
    setRanges((current) => current.filter((range) => range.date !== date));
    setDayError("");
  }

  function draftValue(): string {
    return (days.length === 0 ? dayDraft : extraDraft).trim();
  }

  /** Include the day currently being entered, if it is a real new day. */
  function withDraftDay(): { dates: string[]; ranges: TimeRange[]; error: string | null } {
    const draft = draftValue();
    if (!draft) {
      if (days.length === 0) return { dates: [], ranges, error: "Choose a day you can come, then pick a time." };
      return { dates: days, ranges, error: null };
    }
    if (days.includes(draft)) return { dates: days, ranges, error: null };
    const message = dayChoiceMessage(draft, days);
    if (message) return { dates: [], ranges, error: message };
    return { dates: [...days, draft], ranges: copyHoursOnto(draft, ranges), error: null };
  }

  function rememberDraft(dates: string[]) {
    if (dates.length > days.length) setExtraDraft("");
  }

  function presetIsOn(start: string, end: string): boolean {
    return days.length > 0 && days.every((date) => ranges.some((range) => range.date === date && range.start === start && range.end === end));
  }

  function togglePreset(start: string, end: string) {
    const ready = withDraftDay();
    if (ready.error) {
      setDayError(ready.error);
      setHint("");
      return;
    }
    const on = ready.dates.every((date) =>
      ready.ranges.some((range) => range.date === date && range.start === start && range.end === end),
    );
    const nextRanges = on
      ? ready.ranges.filter((range) => !(ready.dates.includes(range.date) && range.start === start && range.end === end))
      : mergeRanges([...ready.ranges, ...ready.dates.map((date) => ({ date, start, end }))]);
    setDays(ready.dates);
    setRanges(nextRanges);
    rememberDraft(ready.dates);
    setDayError("");
    setHint("");
    setFormError("");
  }

  function addHours(start: string, end: string) {
    if (minutes(end) <= minutes(start)) {
      setHint("The end needs to be later than the start.");
      return;
    }
    const ready = withDraftDay();
    if (ready.error) {
      setDayError(ready.error);
      setHint("");
      return;
    }
    setDays(ready.dates);
    setRanges(mergeRanges([...ready.ranges, ...ready.dates.map((date) => ({ date, start, end }))]));
    rememberDraft(ready.dates);
    setDayError("");
    setHint("");
    setFormError("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setFormError("Add your name so people know who can come.");
      errorRef.current?.focus();
      return;
    }
    if (days.length === 0) {
      setFormError("Add the day you can come.");
      errorRef.current?.focus();
      return;
    }
    const missing = days.filter((date) => !ranges.some((range) => range.date === date));
    if (missing.length > 0) {
      setFormError("Add a time for each day. It can be as short as you like.");
      errorRef.current?.focus();
      return;
    }
    const entry: AvailabilityEntry = {
      id: uid("person"),
      name: name.trim().slice(0, 60),
      note: note.trim().slice(0, 240),
      ranges: mergeRanges(ranges),
      createdAt: new Date().toISOString(),
    };
    const next = [entry, ...entries];
    setEntries(next);
    setSaveError(!saveEntries(next));
    setThanks(entry.name);
    setName("");
    setNote("");
    setDays([]);
    setRanges([]);
    setDayDraft(suggested);
    setExtraDraft("");
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
          <legend>When you can come</legend>
          <p className="field-help" id="day-help">
            Start with one day. Add more only if you need them. Sundays and Thursdays are not on this list.
          </p>
          {orderedDays.length > 0 && (
            <ul className="chosen-days">
              {orderedDays.map((date, index) => (
                <li key={date} className="chosen-day">
                  <span className="day day-key is-on" aria-hidden="true">
                    <span className="day-wd">{formatWeekdayShort(date)}</span>
                    <span className="day-num">{formatDayNum(date)}</span>
                  </span>
                  <span>
                    <span className="chosen-label">{index === 0 ? "Day you can come" : "Another day"}</span>
                    <span className="chosen-date">{formatFullDate(date)}</span>
                  </span>
                  <button type="button" className="text-btn" onClick={() => removeDay(date)}>
                    Remove
                    <span className="sr-only"> {formatFullDate(date)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {days.length === 0 ? (
            <div className="day-add">
              <label htmlFor="day-one">Day you can come</label>
              <div className="day-add-row">
                <input
                  id="day-one"
                  type="date"
                  value={dayDraft}
                  aria-describedby="day-help"
                  aria-invalid={Boolean(dayError)}
                  onChange={(change) => {
                    setDayDraft(change.target.value);
                    setDayError("");
                  }}
                />
                <button type="button" className="btn" onClick={() => addDay(dayDraft)}>
                  Add this day
                </button>
              </div>
            </div>
          ) : (
            <div className="day-add">
              <label htmlFor="day-another">Choose another day</label>
              <div className="day-add-row">
                <input
                  id="day-another"
                  type="date"
                  value={extraDraft}
                  aria-describedby="day-help"
                  aria-invalid={Boolean(dayError)}
                  onChange={(change) => {
                    setExtraDraft(change.target.value);
                    setDayError("");
                  }}
                />
                <button type="button" className="btn" onClick={() => addDay(extraDraft)}>
                  Add this day
                </button>
              </div>
            </div>
          )}
          {dayError && (
            <p className="field-error" role="alert">
              {dayError}
            </p>
          )}

          <div className="hours-board">
            <h2>Hours</h2>
            <p>These are suggestions, not a promise to stay. Come and go as you like. The time is added to every day on your list.</p>
            <div className="presets">
              {PRESETS.map((preset) => {
                const selected = presetIsOn(preset.start, preset.end);
                return (
                  <button
                    key={preset.id}
                    type="button"
                    className="preset"
                    aria-pressed={selected}
                    onClick={() => togglePreset(preset.start, preset.end)}
                  >
                    <span className="preset-name">{preset.label}</span>
                    <span className="preset-time">
                      {formatTime(preset.start)} – {formatTime(preset.end)}
                      {selected ? " · Selected" : ""}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="own-hours">
              <h3>Your own hours</h3>
              <p>Set any start and end. A half hour is fine. Then add them to the days you chose.</p>
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
          <p>
            {days.length === 0
              ? "No day added yet."
              : `${days.length} ${days.length === 1 ? "day" : "days"} · ${ranges.length} time ${ranges.length === 1 ? "block" : "blocks"}`}
          </p>
        </div>
      </form>

      <section className="saved" aria-labelledby="saved-title">
        <h2 id="saved-title">Saved on this device</h2>
        {entries.length === 0 ? (
          <p className="saved-empty">No one has added times in this browser yet.</p>
        ) : (
          <ul className="saved-list">
            {entries.map((entry) => (
              <li key={entry.id}>
                <h3>{entry.name}</h3>
                {entry.note && <p>{entry.note}</p>}
                <ul>
                  {entry.ranges.map((range) => (
                    <li key={`${entry.id}-${range.date}-${range.start}`}>
                      {formatFullDate(range.date)} · {formatTime(range.start)} – {formatTime(range.end)}
                    </li>
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
