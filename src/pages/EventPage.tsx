import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { AvailabilityForm } from "../components/AvailabilityForm";
import { PersonChips } from "../components/Chips";
import { Heatmap } from "../components/Heatmap";
import { PeopleList } from "../components/PeopleList";
import { Places } from "../components/Places";
import { TaskBoard } from "../components/TaskBoard";
import { useGatherings } from "../gatherings";
import { blockPhrase, buildOverlap, peopleWord } from "../lib/overlap";
import { formatFullDate, formatTime, formatWindow } from "../lib/time";
import { useDocumentTitle } from "../useDocumentTitle";

type TabId = "overview" | "tasks" | "hours" | "overlap";

function tabFromHash(hash: string): TabId | null {
  if (hash === "#hours" || hash === "#join") return "hours";
  if (hash === "#tasks" || hash === "#work" || hash === "#places") return "tasks";
  if (hash === "#overlap") return "overlap";
  if (hash === "#overview") return "overview";
  return null;
}

export function EventPage() {
  const { eventId = "" } = useParams();
  const {
    getEvent,
    volunteersFor,
    taskStatus,
    setTaskStatus,
    examplesHidden,
    setExamplesHidden,
    addVolunteer,
    removeVolunteer,
    removeEvent,
  } = useGatherings();
  const navigate = useNavigate();
  const { hash } = useLocation();
  const event = getEvent(eventId);
  useDocumentTitle(event ? `${event.title} — Grace` : "Gathering — Grace");
  const [thanks, setThanks] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [tab, setTab] = useState<TabId>(() => tabFromHash(hash) ?? "overview");

  useEffect(() => {
    setThanks(null);
    setCopied("idle");
    setConfirmRemove(false);
  }, [eventId]);

  useEffect(() => {
    const next = tabFromHash(hash);
    if (next) setTab(next);
  }, [hash, eventId]);

  function selectTab(next: TabId) {
    setTab(next);
    navigate({ hash: next === "overview" ? "" : next }, { replace: true });
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("section-tabs")?.scrollIntoView({
      block: "start",
      behavior: reduce ? "auto" : "smooth",
    });
  }

  const volunteers = event ? volunteersFor(event) : [];
  const volunteerKey = volunteers
    .map(
      (volunteer) =>
        `${volunteer.id}:${volunteer.flexible ? 1 : 0}:${volunteer.taskIds.join(".")}:${volunteer.ranges
          .map((range) => `${range.date}${range.start}${range.end}`)
          .join(",")}`,
    )
    .join("|");
  const stableVolunteers = useMemo(() => volunteers, [volunteerKey]);
  const model = useMemo(
    () => (event ? buildOverlap(event, stableVolunteers) : null),
    [event, stableVolunteers],
  );

  if (!event || !model) {
    return (
      <div className="wrap missing">
        <h1>This gathering is not on this device.</h1>
        <p>It may have been cleared from the browser, or the link is no longer current.</p>
        <Link className="btn btn-primary" to="/">
          Back to gatherings
        </Link>
      </div>
    );
  }

  const gathering = event;
  const best = model.blocks[0];
  const openTasks = event.tasks.filter((task) => taskStatus(event.id, task.id) === "open");
  const openAreas = event.areas.filter((area) => openTasks.some((task) => task.areaId === area.id));
  const hidden = examplesHidden(event.id);

  async function copySummary() {
    const lines = [gathering.title, formatWindow(gathering.windowStart, gathering.windowEnd), ""];
    if (best) {
      lines.push(
        `${best.people.length >= 2 ? "Strongest shared time" : "A time that is open"}: ${formatFullDate(best.date)}, ${formatTime(best.start)} – ${formatTime(best.end)}.`,
      );
      lines.push(blockPhrase(best.people) + ".");
      lines.push(
        best.people.map((person) => (person.example ? `${person.name} (example)` : person.name)).join(", "),
      );
    } else {
      lines.push("No hours have been shared yet.");
    }
    lines.push("");
    lines.push("Saved in this browser with Grace.");
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied("copied");
    } catch {
      setCopied("failed");
    }
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "tasks", label: event.mode === "work" ? "Tasks" : "Places" },
    { id: "hours", label: "Your hours" },
    { id: "overlap", label: "Overlap" },
  ];

  function onTabKey(eventKey: KeyboardEvent<HTMLButtonElement>) {
    const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
    if (!keys.includes(eventKey.key)) return;
    eventKey.preventDefault();
    const index = tabs.findIndex((item) => item.id === tab);
    let next = index;
    if (eventKey.key === "ArrowRight") next = (index + 1) % tabs.length;
    if (eventKey.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    if (eventKey.key === "Home") next = 0;
    if (eventKey.key === "End") next = tabs.length - 1;
    selectTab(tabs[next].id);
    requestAnimationFrame(() => {
      document.getElementById(`tab-${tabs[next].id}`)?.focus();
    });
  }

  return (
    <div className={`season season-${event.season}`}>
      <header className="event-hero wrap">
        {event.sample && (
          <p className="sample-flag" role="note">
            Sample gathering, so you can see Grace hold more than one event. This is not a real invitation.
          </p>
        )}
        <p className="eyebrow">{event.kicker}</p>
        <h1>{event.title}</h1>
        <p className="lede">{event.summary}</p>
        <p className="meta">
          <strong>{formatWindow(event.windowStart, event.windowEnd)}</strong>
          <span>
            {formatTime(event.dayStart)} – {formatTime(event.dayEnd)}
            <span className="meta-quiet"> · Sundays are left off</span>
          </span>
        </p>
      </header>

      <div className="wrap tabs-wrap" id="section-tabs">
        <div className="tabs" role="tablist" aria-label="On this gathering">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`tab-${item.id}`}
              aria-selected={tab === item.id}
              aria-controls={`panel-${item.id}`}
              tabIndex={tab === item.id ? 0 : -1}
              onClick={() => selectTab(item.id)}
              onKeyDown={onTabKey}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {thanks && (
        <div className="wrap">
          <p className="banner" role="status">
            Thank you, {thanks}. Your hours are saved in this browser and already in the chart.
          </p>
        </div>
      )}

      {tab === "overview" && (
        <div className="wrap tab-panel" role="tabpanel" id="panel-overview" aria-labelledby="tab-overview">
          <div className="story">
            {event.story.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          {best ? (
            <article className="best-card best-card-compact">
              <p className="eyebrow">{best.people.length >= 2 ? "Strongest shared time" : "A time that is open"}</p>
              <h2>{formatFullDate(best.date)}</h2>
              <p className="best-hours">
                {formatTime(best.start)} – {formatTime(best.end)}
              </p>
              <p>{blockPhrase(best.people)}.</p>
            </article>
          ) : (
            <p>No hours yet. Add yours and the overlap will start to fill.</p>
          )}
          <div className="hero-actions">
            <button type="button" className="btn btn-primary" onClick={() => selectTab("hours")}>
              Add your hours
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => selectTab("overlap")}>
              See the overlap
            </button>
          </div>
          {event.notes.length > 0 && (
            <aside className="journal">
              <p className="eyebrow">About the work</p>
              {event.notes.map((note) => (
                <p key={note}>{note}</p>
              ))}
            </aside>
          )}
        </div>
      )}

      {tab === "tasks" && (
        <div className="wrap tab-panel" role="tabpanel" id="panel-tasks" aria-labelledby="tab-tasks">
          {event.mode === "work" ? (
            <TaskBoard
              event={event}
              volunteers={stableVolunteers}
              statusOf={(taskId) => taskStatus(event.id, taskId)}
              onStatus={(taskId, status) => setTaskStatus(event.id, taskId, status)}
            />
          ) : (
            <Places
              event={event}
              volunteers={stableVolunteers}
              statusOf={(taskId) => taskStatus(event.id, taskId)}
            />
          )}
        </div>
      )}

      {tab === "hours" && (
        <div className="wrap tab-panel join-wrap" role="tabpanel" id="panel-hours" aria-labelledby="tab-hours">
          <AvailabilityForm
            key={formKey}
            event={event}
            areas={openAreas.length > 0 ? openAreas : event.areas}
            tasks={openTasks.length > 0 ? openTasks : event.tasks}
            onSubmit={(draft) => {
              addVolunteer(event.id, draft);
              setThanks(draft.name);
              setFormKey((value) => value + 1);
              selectTab("overlap");
            }}
          />
          <PeopleList
            event={event}
            volunteers={stableVolunteers}
            examplesHidden={hidden}
            onToggleExamples={(next) => setExamplesHidden(event.id, next)}
            onRemove={(id) => removeVolunteer(event.id, id)}
            statusOf={(taskId) => taskStatus(event.id, taskId)}
          />
        </div>
      )}

      {tab === "overlap" && (
        <div className="wrap tab-panel" role="tabpanel" id="panel-overlap" aria-labelledby="tab-overlap">
          <section className="panel overlap-panel" aria-labelledby="overlap-title">
            <div className="section-head">
              <h2 id="overlap-title">When hours overlap</h2>
              <p>
                Each square is a half hour, Monday through Saturday. The number is how many people can be there. A gold
                edge marks the strongest block.
              </p>
            </div>
            <div className="best-layout">
              <article className="best-card">
                {best ? (
                  <>
                    <p className="eyebrow">{best.people.length >= 2 ? "Strongest shared time" : "A time that is open"}</p>
                    <h3>{formatFullDate(best.date)}</h3>
                    <p className="best-hours">
                      {formatTime(best.start)} – {formatTime(best.end)}
                    </p>
                    <p>{blockPhrase(best.people)}.</p>
                    <PersonChips people={best.people} />
                  </>
                ) : (
                  <>
                    <p className="eyebrow">Waiting on hours</p>
                    <h3>No one has shared a time yet.</h3>
                    <button type="button" className="btn btn-light" onClick={() => selectTab("hours")}>
                      Add your hours
                    </button>
                  </>
                )}
              </article>
              {model.blocks.length > 1 && (
                <div className="also">
                  <h3>Other strong blocks</h3>
                  <ol>
                    {model.blocks.slice(1).map((block) => (
                      <li key={`${block.date}-${block.start}`}>
                        <span className="also-when">
                          <span>{formatFullDate(block.date)}</span>
                          <span className="also-time">
                            {formatTime(block.start)} – {formatTime(block.end)}
                          </span>
                        </span>
                        <span className="also-count">{peopleWord(block.people.length)}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
            <Heatmap key={event.id} event={event} model={model} />
            <div className="summary-row">
              <button type="button" className="btn btn-ghost btn-small" onClick={() => void copySummary()}>
                Copy a summary
              </button>
              {copied === "copied" && <p role="status">Copied.</p>}
              {copied === "failed" && (
                <p role="status">The browser blocked copying. The times above are ready to select by hand.</p>
              )}
            </div>
          </section>
          {event.mode === "work" && (
            <Places
              event={event}
              volunteers={stableVolunteers}
              statusOf={(taskId) => taskStatus(event.id, taskId)}
            />
          )}
        </div>
      )}

      {!event.featured && !event.sample && (
        <div className="wrap event-remove">
          {confirmRemove ? (
            <p className="confirm-row">
              <span>Remove this gathering from this browser?</span>
              <button
                type="button"
                className="btn btn-small btn-ghost"
                onClick={() => {
                  removeEvent(event.id);
                  navigate("/");
                }}
              >
                Remove
              </button>
              <button type="button" className="btn btn-ghost btn-small" onClick={() => setConfirmRemove(false)}>
                Keep
              </button>
            </p>
          ) : (
            <button type="button" className="text-btn" onClick={() => setConfirmRemove(true)}>
              Remove this gathering from this browser
            </button>
          )}
        </div>
      )}
    </div>
  );
}
