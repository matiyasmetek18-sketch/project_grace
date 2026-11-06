import { useMemo, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useGatherings } from "../gatherings";
import { buildCustomGathering, validateCustomEvent, type CustomEventInput } from "../lib/customEvent";
import { uid } from "../lib/id";
import { defaultGatheringWindow, formatTime, halfHours } from "../lib/time";
import type { GatheringMode } from "../types";
import { useDocumentTitle } from "../useDocumentTitle";

type AreaDraft = { key: string; name: string; tasks: string };

export function NewEventPage() {
  useDocumentTitle("Plan a gathering — Grace");
  const navigate = useNavigate();
  const { addEvent } = useGatherings();
  const initialWindow = useMemo(() => defaultGatheringWindow(new Date()), []);
  const hours = halfHours();
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [story, setStory] = useState("");
  const [mode, setMode] = useState<GatheringMode>("work");
  const [windowStart, setWindowStart] = useState(initialWindow.start);
  const [windowEnd, setWindowEnd] = useState(initialWindow.end);
  const [dayStart, setDayStart] = useState("08:00");
  const [dayEnd, setDayEnd] = useState("16:00");
  const [areas, setAreas] = useState<AreaDraft[]>([{ key: uid("row"), name: "", tasks: "" }]);
  const [errors, setErrors] = useState<{ id: string; message: string }[]>([]);
  const errorRef = useRef<HTMLDivElement>(null);

  function updateMode(next: GatheringMode) {
    setMode(next);
    const untouched =
      (dayStart === "08:00" && dayEnd === "16:00") || (dayStart === "17:00" && dayEnd === "21:00");
    if (!untouched) return;
    if (next === "meet") {
      setDayStart("17:00");
      setDayEnd("21:00");
    } else {
      setDayStart("08:00");
      setDayEnd("16:00");
    }
  }

  function submit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const input: CustomEventInput = {
      title,
      summary,
      story,
      mode,
      windowStart,
      windowEnd,
      dayStart,
      dayEnd,
      areas: areas.map((area) => ({ name: area.name, tasks: area.tasks })),
    };
    const next = validateCustomEvent(input);
    setErrors(next);
    if (next.length > 0) {
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    const id = uid("event");
    const gathering = buildCustomGathering(input, id, new Date().toISOString());
    addEvent(gathering);
    navigate(`/events/${id}`);
  }

  const placeWord = mode === "meet" ? "Place" : "Area";

  return (
    <div className="wrap new-event">
      <header className="page-intro">
        <p className="eyebrow">On this device</p>
        <h1>Plan a gathering</h1>
        <p className="lede">
          Add a work day or a meet-up beside the others. People can share hours without an account. What you create
          stays in this browser.
        </p>
      </header>
      <form className="join" onSubmit={submit} noValidate>
        {errors.length > 0 && (
          <div className="form-errors" role="alert" tabIndex={-1} ref={errorRef}>
            <p>Please fix the following:</p>
            <ul>
              {errors.map((error) => (
                <li key={error.id}>
                  <a href={`#${error.id}`}>{error.message}</a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <fieldset className="field">
          <legend>What kind of gathering?</legend>
          <div className="mode-picks">
            <label className={mode === "work" ? "mode-pick is-on" : "mode-pick"}>
              <input type="radio" name="mode" checked={mode === "work"} onChange={() => updateMode("work")} />
              <span>
                <strong>Work day</strong>
                <small>Areas and tasks people can take on.</small>
              </span>
            </label>
            <label className={mode === "meet" ? "mode-pick is-on" : "mode-pick"}>
              <input type="radio" name="mode" checked={mode === "meet"} onChange={() => updateMode("meet")} />
              <span>
                <strong>Meet-up</strong>
                <small>Times, and places people would rather sit.</small>
              </span>
            </label>
          </div>
        </fieldset>

        <div className="field">
          <label htmlFor="event-title">Name</label>
          <input
            id="event-title"
            maxLength={80}
            value={title}
            aria-invalid={errors.some((error) => error.id === "event-title")}
            onChange={(change) => setTitle(change.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="event-summary">One sentence</label>
          <input
            id="event-summary"
            maxLength={240}
            value={summary}
            aria-invalid={errors.some((error) => error.id === "event-summary")}
            onChange={(change) => setSummary(change.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="event-story">A longer note, if you want</label>
          <textarea id="event-story" value={story} onChange={(change) => setStory(change.target.value)} />
        </div>

        <div className="split">
          <div className="field">
            <label htmlFor="event-start">First day</label>
            <input
              id="event-start"
              type="date"
              value={windowStart}
              aria-invalid={errors.some((error) => error.id === "event-start")}
              onChange={(change) => setWindowStart(change.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="event-end">Last day</label>
            <input id="event-end" type="date" value={windowEnd} onChange={(change) => setWindowEnd(change.target.value)} />
          </div>
        </div>
        <div className="split">
          <div className="field">
            <label htmlFor="event-hours-start">Earliest hour</label>
            <select
              id="event-hours-start"
              value={dayStart}
              aria-invalid={errors.some((error) => error.id === "event-hours-start")}
              onChange={(change) => setDayStart(change.target.value)}
            >
              {hours.map((hour) => (
                <option key={hour} value={hour}>
                  {formatTime(hour)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="event-hours-end">Latest hour</label>
            <select id="event-hours-end" value={dayEnd} onChange={(change) => setDayEnd(change.target.value)}>
              {hours.map((hour) => (
                <option key={hour} value={hour}>
                  {formatTime(hour)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <fieldset className="field" id="areas-fieldset" tabIndex={-1}>
          <legend>{mode === "meet" ? "Places to meet" : "Areas and tasks"}</legend>
          <p className="field-help">
            {mode === "meet"
              ? "Name each place someone might choose."
              : "Name an area, then list tasks, one per line. Leave the tasks blank to let people choose the area itself."}
          </p>
          {areas.map((area, index) => (
            <div key={area.key} className="area-draft">
              <div className="field">
                <label htmlFor={`area-${area.key}`}>{placeWord} name</label>
                <input
                  id={`area-${area.key}`}
                  value={area.name}
                  onChange={(change) =>
                    setAreas((current) =>
                      current.map((item) => (item.key === area.key ? { ...item, name: change.target.value } : item)),
                    )
                  }
                />
              </div>
              {mode === "work" && (
                <div className="field">
                  <label htmlFor={`tasks-${area.key}`}>Tasks, one per line</label>
                  <textarea
                    id={`tasks-${area.key}`}
                    value={area.tasks}
                    onChange={(change) =>
                      setAreas((current) =>
                        current.map((item) => (item.key === area.key ? { ...item, tasks: change.target.value } : item)),
                      )
                    }
                  />
                </div>
              )}
              {areas.length > 1 && (
                <button
                  type="button"
                  className="text-btn"
                  onClick={() => setAreas((current) => current.filter((item) => item.key !== area.key))}
                >
                  Remove {area.name.trim() || `${placeWord.toLowerCase()} ${index + 1}`}
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setAreas((current) => [...current, { key: uid("row"), name: "", tasks: "" }])}
          >
            Add another {placeWord.toLowerCase()}
          </button>
        </fieldset>

        <div className="join-submit">
          <button type="submit" className="btn btn-primary">
            Create the gathering
          </button>
        </div>
      </form>
    </div>
  );
}
