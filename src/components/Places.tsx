import { useState } from "react";
import type { Gathering, TaskStatus, Volunteer } from "../types";
import { areaPull, heatStep, peopleWord, type AreaPull } from "../lib/overlap";
import { PersonChips } from "./Chips";

function ranked(areas: AreaPull[]): AreaPull[] {
  return [...areas].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function Places({
  event,
  volunteers,
  statusOf,
}: {
  event: Gathering;
  volunteers: Volunteer[];
  statusOf: (taskId: string) => TaskStatus;
}) {
  const pull = areaPull(event, volunteers, statusOf);
  const max = Math.max(0, ...pull.areas.map((area) => area.count), pull.flexible.length);
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = pull.areas.find((area) => area.areaId === activeId) ?? null;
  const heading =
    event.sketch === "grounds"
      ? "Where people are drawn"
      : event.mode === "meet"
        ? "Where people hope to meet"
        : "What people are drawn to";
  const intro =
    event.sketch === "grounds"
      ? "A sketch of the grounds, not a survey. North is up, and distances are invented. Color deepens where more people have offered to help."
      : event.sketch === "rooms"
        ? "Color deepens in the room more people hope to use."
        : "The bars lengthen as more people choose that part of the gathering.";

  return (
    <section id="places" className="panel" aria-labelledby="places-title">
      <div className="section-head">
        <p className="index">02</p>
        <h2 id="places-title">{heading}</h2>
        <p>{intro}</p>
      </div>

      {event.sketch === "grounds" && (
        <div className="grounds" role="group" aria-label="Sketch of the grounds">
          {pull.areas
            .filter((area) => area.place)
            .map((area) => {
              const step = heatStep(area.count, max);
              const pressed = activeId === area.areaId;
              return (
                <button
                  key={area.areaId}
                  type="button"
                  className="plot"
                  data-area={area.place}
                  data-step={step}
                  style={{ gridArea: area.place }}
                  aria-pressed={pressed}
                  onClick={() => setActiveId(pressed ? null : area.areaId)}
                >
                  <span className="plot-count">{area.count === 0 ? "Open" : peopleWord(area.count)}</span>
                  <span className="plot-name">{area.name}</span>
                  {area.blurb && <span className="plot-blurb">{area.blurb}</span>}
                </button>
              );
            })}
        </div>
      )}

      {event.sketch === "rooms" && (
        <ul className="rooms">
          {pull.areas.map((area) => {
            const step = heatStep(area.count, max);
            const pressed = activeId === area.areaId;
            return (
              <li key={area.areaId}>
                <button
                  type="button"
                  className="room"
                  data-step={step}
                  aria-pressed={pressed}
                  onClick={() => setActiveId(pressed ? null : area.areaId)}
                >
                  <span className="plot-count">{area.count === 0 ? "Open" : peopleWord(area.count)}</span>
                  <span className="plot-name">{area.name}</span>
                  {area.blurb && <span className="plot-blurb">{area.blurb}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {active && (
        <div className="place-detail" role="region" aria-label={active.name}>
          <h3>{active.name}</h3>
          {active.blurb && <p>{active.blurb}</p>}
          {active.people.length === 0 ? (
            <p>No one has chosen this yet.</p>
          ) : (
            <PersonChips people={active.people} />
          )}
          {active.tasks.length > 0 && (
            <ul className="task-mini">
              {active.tasks.map((task) => (
                <li key={task.taskId}>
                  <span>{task.title}</span>
                  <span>{task.count === 0 ? "No one yet" : peopleWord(task.count)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <ol className="furrows">
        {ranked(pull.areas).map((area) => (
          <li key={area.areaId}>
            <div className="furrow-label">
              <span>{area.name}</span>
              <span>{area.count === 0 ? "No one yet" : peopleWord(area.count)}</span>
            </div>
            <div className="furrow-track" aria-hidden="true">
              <span style={{ width: max === 0 ? "0%" : `${(area.count / max) * 100}%` }} />
            </div>
          </li>
        ))}
        {pull.flexible.length > 0 && (
          <li>
            <div className="furrow-label">
              <span>Wherever needed</span>
              <span>{peopleWord(pull.flexible.length)}</span>
            </div>
            <div className="furrow-track" aria-hidden="true">
              <span style={{ width: max === 0 ? "0%" : `${(pull.flexible.length / max) * 100}%` }} />
            </div>
          </li>
        )}
      </ol>
    </section>
  );
}
