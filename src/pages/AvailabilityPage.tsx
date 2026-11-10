import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { CommonTimes } from "../components/CommonTimes";
import type { TimeRange } from "../types";
import { countsInCommonTimes, sameOffer, type AvailabilityEntry } from "../lib/availabilityStore";
import { fetchSharedAnswers, publishSharedAnswer, removeSharedAnswer } from "../lib/sharedAnswers";
import { uid } from "../lib/id";
import {
  DUPLICATE_DAY_MESSAGE,
  dayChoiceMessage,
  offeredDayMessage,
  formatDayNum,
  formatFullDate,
  formatISODate,
  formatRange,
  formatTime,
  formatWeekdayShort,
  halfHours,
  keepSeparateRanges,
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

function thanksCopy(name: string): string {
  return `Thank you, ${name}. Anyone with this page can see your times.`;
}

function nextOpenDay(today = new Date()): string {
  const date = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  while (date.getDay() === 0 || date.getDay() === 4) date.setDate(date.getDate() + 1);
  return formatISODate(date);
}

function copyHoursOnto(date: string, ranges: TimeRange[]): TimeRange[] {
  const pairs = new Map<string, { start: string; end: string }>();
  for (const range of ranges) pairs.set(`${range.start}-${range.end}`, { start: range.start, end: range.end });
  const added = [...pairs.values()].map((pair) => ({ date, ...pair }));
  return keepSeparateRanges([...ranges, ...added]);
}

export function AvailabilityPage() {
  useDocumentTitle("Grace — when you can come");
  const suggested = useMemo(() => nextOpenDay(), []);
  const [entries, setEntries] = useState<AvailabilityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [awaitingList, setAwaitingList] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [listProblem, setListProblem] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [days, setDays] = useState<string[]>([]);
  const [dayDraft, setDayDraft] = useState(suggested);
  const [extraDraft, setExtraDraft] = useState("");
  const [dayError, setDayError] = useState("");
  const [dayErrorTick, setDayErrorTick] = useState(0);
  const [ranges, setRanges] = useState<TimeRange[]>([]);
  const [customStart, setCustomStart] = useState("09:00");
  const [customEnd, setCustomEnd] = useState("11:00");
  const [formError, setFormError] = useState("");
  const [formErrorTick, setFormErrorTick] = useState(0);
  const [thanks, setThanks] = useState("");
  const [unconfirmed, setUnconfirmed] = useState("");
  const [noticeFocus, setNoticeFocus] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const bannerText = useRef("");
  const [listFocusTick, setListFocusTick] = useState(0);
  const [removedNotice, setRemovedNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<AvailabilityEntry | null>(null);
  const [removing, setRemoving] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const dayErrorRef = useRef<HTMLParagraphElement>(null);
  const timeErrorRef = useRef<HTMLParagraphElement>(null);
  const listRequest = useRef(0);
  const savingRef = useRef(false);
  const removingRef = useRef(false);
  const removeTrigger = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const savedTitleRef = useRef<HTMLHeadingElement>(null);
  const thanksRef = useRef<HTMLParagraphElement>(null);
  const focusAfterLoad = useRef(false);
  const heldIds = useRef(new Map<string, "fresh" | number>());
  const checkAgainFocus = useRef(false);
  const pendingSave = useRef<AvailabilityEntry | null>(null);
  const keepProblem = useRef(false);
  const removeTitleRef = useRef<HTMLHeadingElement>(null);
  const afterRemoveFocus = useRef<"trigger" | "list" | null>(null);
  const todayIso = formatISODate(new Date());

  const loadList = useCallback(async () => {
    const requestId = ++listRequest.current;
    const focusIfConfirmed = checkAgainFocus.current;
    checkAgainFocus.current = false;
    try {
      const shared = await fetchSharedAnswers();
      if (requestId !== listRequest.current) return;
      const sharedIds = new Set(shared.map((row) => row.id));
      const pending = pendingSave.current;
      const matched = pending ? shared.find((row) => row.id === pending.id || sameOffer(row, pending)) : undefined;
      if (matched) {
        const nextThanks = thanksCopy(matched.name);
        const alreadyThanks = bannerText.current === nextThanks;
        pendingSave.current = null;
        heldIds.current.delete(matched.id);
        bannerText.current = nextThanks;
        setUnconfirmed("");
        setThanks(matched.name);
        if (focusIfConfirmed) {
          setStatusMessage("");
          setNoticeFocus((tick) => tick + 1);
        } else if (!alreadyThanks) {
          setStatusMessage(nextThanks);
        }
      }
      for (const id of sharedIds) heldIds.current.delete(id);
      setEntries((current) => {
        const kept = current.filter((item) => {
          if (sharedIds.has(item.id)) return false;
          if (shared.some((row) => sameOffer(row, item))) return false;
          if (!item.fromServer) return true;
          const held = heldIds.current.get(item.id);
          // One lagging list may omit a just-saved id. The next list is the server's.
          return held === "fresh" || held === requestId;
        });
        for (const [id, held] of [...heldIds.current]) {
          if (held === "fresh") heldIds.current.set(id, requestId);
          else if (held !== requestId) heldIds.current.delete(id);
        }
        return [...kept, ...shared];
      });
      if (keepProblem.current) keepProblem.current = false;
      else setListProblem("");
      setLoadFailed(false);
      if (focusAfterLoad.current) {
        focusAfterLoad.current = false;
        setListFocusTick((tick) => tick + 1);
      }
    } catch {
      if (requestId !== listRequest.current) return;
      if (pendingSave.current && !pendingSave.current.fromServer) {
        setUnconfirmed(pendingSave.current.name);
        setThanks("");
        setListProblem("");
        setLoadFailed(false);
      } else {
        setListProblem("The shared list did not load.");
        setLoadFailed(true);
      }
    } finally {
      if (requestId === listRequest.current) {
        setLoading(false);
        setAwaitingList(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadList();
    function onVisible() {
      if (document.visibilityState === "visible") void loadList();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      listRequest.current += 1;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loadList]);

  function showFormError(message: string) {
    setFormError(message);
    setFormErrorTick((tick) => tick + 1);
  }

  function showDayError(message: string) {
    setDayError(message);
    setDayErrorTick((tick) => tick + 1);
  }

  useEffect(() => {
    if (formError) errorRef.current?.focus();
  }, [formError, formErrorTick]);

  useEffect(() => {
    if (noticeFocus === 0) return;
    const node = thanksRef.current;
    if (!node) return;
    const media = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    const reduceMotion = media?.matches ?? false;
    const behavior = reduceMotion ? "auto" : "instant";
    const root = document.documentElement;
    const previousBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    const scrollTo = (top: number) => {
      try {
        window.scrollTo({ top, behavior });
      } catch {
        window.scrollTo(0, top);
      }
    };
    scrollTo(window.scrollY);
    const headerBottom = document.querySelector(".topbar")?.getBoundingClientRect().bottom ?? 0;
    const margin = Number.parseFloat(getComputedStyle(node).scrollMarginTop) || 0;
    const clearance = Math.max(margin, headerBottom);
    const rect = node.getBoundingClientRect();
    const fullyVisible = rect.top >= headerBottom - 0.5 && rect.bottom <= window.innerHeight + 0.5;
    if (!fullyVisible) scrollTo(Math.max(0, window.scrollY + rect.top - clearance));
    root.style.scrollBehavior = previousBehavior;
    node.focus({ preventScroll: true });
  }, [noticeFocus]);

  useEffect(() => {
    if (listFocusTick === 0) return;
    savedTitleRef.current?.focus();
  }, [listFocusTick]);

  useEffect(() => {
    if (dayError) dayErrorRef.current?.focus();
  }, [dayError, dayErrorTick]);

  useEffect(() => {
    if (dayError !== DUPLICATE_DAY_MESSAGE) return;
    const draft = (days.length === 0 ? dayDraft : extraDraft).trim();
    if (!days.includes(draft)) setDayError("");
  }, [dayError, days, dayDraft, extraDraft]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (pendingRemove) {
      if (dialog && !dialog.open) dialog.showModal();
      cancelButtonRef.current?.focus();
      return;
    }
    const where = afterRemoveFocus.current;
    afterRemoveFocus.current = null;
    if (where === "trigger") removeTrigger.current?.focus();
    if (where === "list") savedTitleRef.current?.focus();
  }, [pendingRemove]);

  const startOptions = useMemo(() => halfHours(DAY_START, "20:30"), []);
  const endOptions = useMemo(() => halfHours("07:30", DAY_END), []);
  const timeError = minutes(customEnd) <= minutes(customStart);
  const orderedDays = [...days].sort();
  const nameInvalid = formError.startsWith("Add your name");
  const daysInvalid = formError.startsWith("Add the day") || formError.startsWith("Add a time");
  const sendInvalid = formError.startsWith("This answer was not sent");
  const listStatus = awaitingList ? "loading" : loadFailed && entries.length === 0 ? "error" : "ready";
  const saveBanner = thanks
    ? thanksCopy(thanks)
    : unconfirmed
      ? `${unconfirmed}, your answer was sent, but the list has not confirmed it yet.`
      : "";

  function dayDescribedBy(): string {
    return ["day-help", dayError ? "day-error" : "", daysInvalid ? "form-error" : ""].filter(Boolean).join(" ");
  }

  function addDay(value: string) {
    const message = dayChoiceMessage(value, days, todayIso);
    if (message) {
      showDayError(message);
      return;
    }
    setDays((current) => [...current, value]);
    setRanges((current) => copyHoursOnto(value, current));
    setDayError("");
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
    const message = dayChoiceMessage(draft, days, todayIso);
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
      showDayError(ready.error);
      return;
    }
    const on = ready.dates.every((date) =>
      ready.ranges.some((range) => range.date === date && range.start === start && range.end === end),
    );
    const nextRanges = on
      ? ready.ranges.filter((range) => !(ready.dates.includes(range.date) && range.start === start && range.end === end))
      : keepSeparateRanges([...ready.ranges, ...ready.dates.map((date) => ({ date, start, end }))]);
    setDays(ready.dates);
    setRanges(nextRanges);
    rememberDraft(ready.dates);
    setDayError("");
    setFormError("");
  }

  function addHours(start: string, end: string) {
    if (minutes(end) <= minutes(start)) {
      timeErrorRef.current?.focus();
      return;
    }
    const ready = withDraftDay();
    if (ready.error) {
      showDayError(ready.error);
      return;
    }
    setDays(ready.dates);
    setRanges(keepSeparateRanges([...ready.ranges, ...ready.dates.map((date) => ({ date, start, end }))]));
    rememberDraft(ready.dates);
    setDayError("");
    setFormError("");
  }

  function announce(text: string) {
    setRemovedNotice("");
    window.setTimeout(() => setRemovedNotice(text), 0);
  }

  function retryLoad() {
    focusAfterLoad.current = true;
    setLoading(true);
    setListProblem("");
    setLoadFailed(false);
    void loadList();
  }

  function askRemove(entry: AvailabilityEntry, event: MouseEvent<HTMLButtonElement>) {
    removeTrigger.current = event.currentTarget;
    setPendingRemove(entry);
  }

  function cancelRemove() {
    if (removingRef.current) return;
    afterRemoveFocus.current = "trigger";
    dialogRef.current?.close();
    setPendingRemove(null);
  }

  async function confirmRemove() {
    if (!pendingRemove || removingRef.current) return;
    const entry = pendingRemove;
    removingRef.current = true;
    setRemoving(true);
    removeTitleRef.current?.focus();
    try {
      const outcome = await removeSharedAnswer(entry.id);
      heldIds.current.delete(entry.id);
      setEntries((current) => current.filter((item) => item.id !== entry.id));
      if (outcome === "already-removed") {
        keepProblem.current = true;
        setListProblem(`${entry.name} was already removed.`);
        setRemovedNotice("");
        void loadList();
      } else {
        setListProblem("");
        announce(`Removed ${entry.name}`);
      }
      afterRemoveFocus.current = "list";
      dialogRef.current?.close();
      setPendingRemove(null);
    } catch (error) {
      const raw = error instanceof Error ? error.message : "";
      setListProblem(raw && raw !== "Failed to fetch" ? raw : "The shared list could not be reached. Try again.");
      afterRemoveFocus.current = "trigger";
      dialogRef.current?.close();
      setPendingRemove(null);
    } finally {
      removingRef.current = false;
      setRemoving(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current) return;
    if (!name.trim()) {
      showFormError("Add your name so people know who can come.");
      return;
    }
    if (days.length === 0) {
      showFormError("Add the day you can come.");
      return;
    }
    const missing = days.filter((date) => !ranges.some((range) => range.date === date));
    if (missing.length > 0) {
      showFormError("Add a time for each day. It can be as short as you like.");
      return;
    }
    for (const range of ranges) {
      const message = offeredDayMessage(range.date);
      if (message) {
        showFormError(message);
        return;
      }
    }
    const entry: AvailabilityEntry = {
      id: `pending-${uid("person")}`,
      fromServer: false,
      name: name.trim().slice(0, 60),
      note: note.trim().slice(0, 240),
      ranges: keepSeparateRanges(ranges),
      createdAt: new Date().toISOString(),
    };
    savingRef.current = true;
    setSaving(true);
    try {
      const published = await publishSharedAnswer(entry);
      const saved = published.entry;
      pendingSave.current = saved;
      if (saved.fromServer) heldIds.current.set(saved.id, "fresh");
      setEntries((current) => [saved, ...current.filter((item) => item.id !== saved.id && !sameOffer(item, saved))]);
      if (published.confirmed) {
        setUnconfirmed("");
        setThanks(saved.name);
        bannerText.current = thanksCopy(saved.name);
      } else {
        setThanks("");
        setUnconfirmed(saved.name);
        bannerText.current = `${saved.name}, your answer was sent, but the list has not confirmed it yet.`;
      }
      setStatusMessage("");
      setNoticeFocus((tick) => tick + 1);
      void loadList();
      setName("");
      setNote("");
      setDays([]);
      setRanges([]);
      setDayDraft(suggested);
      setExtraDraft("");
      setDayError("");
      setFormError("");
    } catch {
      showFormError("This answer was not sent. Try again.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
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
          <p id="form-error" className="form-errors" role="alert" tabIndex={-1} ref={errorRef}>
            {formError}
          </p>
        )}
        <p id="save-status" className="sr-only" role="status" aria-live="polite">
          {statusMessage}
        </p>
        {saveBanner && (
          <div className={unconfirmed && !thanks ? "banner banner-warn" : "banner"}>
            <p id={thanks ? "thanks" : "save-unconfirmed"} tabIndex={-1} ref={thanksRef}>
              {saveBanner}
            </p>
            {unconfirmed && !thanks ? (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  checkAgainFocus.current = true;
                  void loadList();
                }}
              >
                Check again
              </button>
            ) : null}
          </div>
        )}

        <div className="field">
          <label htmlFor="avail-name">Your name</label>
          <input
            id="avail-name"
            name="name"
            autoComplete="name"
            maxLength={60}
            value={name}
            aria-invalid={nameInvalid || undefined}
            aria-describedby={nameInvalid ? "form-error" : undefined}
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
                    <span aria-hidden="true">Remove</span>
                    <span className="sr-only">Remove {formatFullDate(date)}</span>
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
                  min={todayIso}
                  aria-describedby={dayDescribedBy()}
                  aria-invalid={Boolean(dayError) || daysInvalid || undefined}
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
                  min={todayIso}
                  aria-describedby={dayDescribedBy()}
                  aria-invalid={Boolean(dayError) || daysInvalid || undefined}
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
            <p id="day-error" className="field-error" role="alert" tabIndex={-1} ref={dayErrorRef}>
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
                    aria-invalid={timeError || undefined}
                    aria-describedby={timeError ? "hours-error" : undefined}
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
              {timeError && (
                <p id="hours-error" className="field-error" role="alert" tabIndex={-1} ref={timeErrorRef}>
                  The end needs to be later than the start.
                </p>
              )}
            </div>
          </div>

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
                    <span aria-hidden="true">Remove</span>
                    <span className="sr-only">Remove {formatRange(range)}</span>
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
          <button
            type="submit"
            className={saving ? "btn btn-primary is-busy" : "btn btn-primary"}
            disabled={saving}
            aria-describedby={sendInvalid ? "form-error" : undefined}
          >
            {saving ? "Sending…" : "Share when I can come"}
          </button>
          <p>
            {days.length === 0
              ? "No day added yet."
              : `${days.length} ${days.length === 1 ? "day" : "days"} · ${ranges.length} time ${ranges.length === 1 ? "block" : "blocks"}`}
          </p>
        </div>
      </form>

      <CommonTimes answers={entries.filter((entry) => countsInCommonTimes(entry))} status={listStatus} />

      <section className="saved" aria-labelledby="saved-title" aria-busy={loading}>
        <h2 id="saved-title" tabIndex={-1} ref={savedTitleRef}>
          Everyone's answers
        </h2>
        <p className="field-help">Anyone who opens this page sees the same list.</p>
        <p className="sr-only" role="status">
          {removedNotice}
        </p>
        {listProblem && (
          <div className="banner banner-warn" role="alert">
            <p>{listProblem}</p>
            {loadFailed && (
              <button type="button" className="btn" onClick={retryLoad}>
                Try again
              </button>
            )}
          </div>
        )}
        {awaitingList ? <p className="saved-empty">Loading answers…</p> : null}
        {entries.length === 0 && !awaitingList && !loadFailed ? (
          <p className="saved-empty">No one has added a time yet.</p>
        ) : entries.length > 0 ? (
          <ul className="saved-list">
            {entries.map((entry) => (
              <li key={entry.id} className={entry.fromServer ? undefined : "is-pending"}>
                <h3>
                  {entry.name}
                  {!entry.fromServer && <span className="pending-tag">Not confirmed yet</span>}
                </h3>
                {entry.note && <p>{entry.note}</p>}
                <ul>
                  {entry.ranges.map((range) => (
                    <li key={`${entry.id}-${range.date}-${range.start}`}>
                      {formatFullDate(range.date)} ·{" "}
                      <span className="time-keep">
                        {formatTime(range.start)} – {formatTime(range.end)}
                      </span>
                    </li>
                  ))}
                </ul>
                {entry.fromServer && (
                  <button type="button" className="text-btn" onClick={(event) => askRemove(entry, event)}>
                    Remove {entry.name}
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <dialog
        ref={dialogRef}
        className="sheet"
        aria-labelledby="remove-title"
        aria-describedby="remove-copy"
        onCancel={(event) => {
          event.preventDefault();
          cancelRemove();
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            cancelRemove();
            return;
          }
          if (event.key !== "Tab") return;
          const dialog = dialogRef.current;
          if (!dialog) return;
          const items = [...dialog.querySelectorAll<HTMLElement>("button, [href], input, select, textarea")].filter(
            (item) => !item.hasAttribute("disabled"),
          );
          if (items.length === 0) return;
          const first = items[0];
          const last = items[items.length - 1];
          const active = document.activeElement;
          if (event.shiftKey && (active === first || !dialog.contains(active))) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
            event.preventDefault();
            first.focus();
          }
        }}
      >
        {pendingRemove && (
          <>
            <h2 id="remove-title" tabIndex={-1} ref={removeTitleRef}>
              Remove {pendingRemove.name}?
            </h2>
            <p id="remove-copy">{pendingRemove.name}&apos;s answer will be taken off the shared list.</p>
            <div className="dialog-actions">
              <button
                ref={cancelButtonRef}
                type="button"
                className="btn btn-ghost"
                aria-disabled={removing || undefined}
                onClick={() => {
                  if (removingRef.current) return;
                  cancelRemove();
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className={removing ? "btn is-busy" : "btn"}
                aria-disabled={removing || undefined}
                onClick={() => {
                  if (removingRef.current) return;
                  void confirmRemove();
                }}
              >
                {removing ? "Removing…" : `Remove ${pendingRemove.name}`}
              </button>
            </div>
          </>
        )}
      </dialog>
    </div>
  );
}
