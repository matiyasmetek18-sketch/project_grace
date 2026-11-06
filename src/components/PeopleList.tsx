import { useState } from "react";
import type { Gathering, TaskStatus, Volunteer } from "../types";
import { formatRange } from "../lib/time";

export function PeopleList({
  event,
  volunteers,
  examplesHidden,
  onToggleExamples,
  onRemove,
  statusOf,
}: {
  event: Gathering;
  volunteers: Volunteer[];
  examplesHidden: boolean;
  onToggleExamples: (hidden: boolean) => void;
  onRemove: (id: string) => void;
  statusOf: (taskId: string) => TaskStatus;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const people = volunteers.filter((volunteer) => !volunteer.example);
  const examples = volunteers.filter((volunteer) => volunteer.example);
  const taskTitle = new Map(event.tasks.map((task) => [task.id, task]));

  function renderPerson(volunteer: Volunteer) {
    return (
      <li key={volunteer.id} className={volunteer.example ? "person person-example" : "person"}>
        <div className="person-top">
          <h3>{volunteer.name}</h3>
          {volunteer.example && <span className="badge">Example</span>}
        </div>
        {volunteer.note && <p className="person-note">{volunteer.note}</p>}
        <ul className="person-ranges">
          {volunteer.ranges.map((range) => (
            <li key={`${range.date}-${range.start}`}>{formatRange(range)}</li>
          ))}
        </ul>
        {volunteer.flexible && <p>Can help wherever needed.</p>}
        {volunteer.taskIds.length > 0 && (
          <ul className="person-tasks">
            {volunteer.taskIds.map((id) => {
              const task = taskTitle.get(id);
              if (!task) return null;
              const status = statusOf(id);
              const tag = status === "done" ? "Done" : status === "later" ? "Waiting on the season" : "";
              return (
                <li key={id}>
                  {task.title}
                  {tag && <span className="heft">{tag}</span>}
                </li>
              );
            })}
          </ul>
        )}
        {pending === volunteer.id ? (
          <p className="confirm-row">
            <span>Remove {volunteer.name} from this browser?</span>
            <button type="button" className="btn btn-small" onClick={() => onRemove(volunteer.id)}>
              Remove
            </button>
            <button type="button" className="btn btn-ghost btn-small" onClick={() => setPending(null)}>
              Keep
            </button>
          </p>
        ) : (
          <button type="button" className="text-btn" onClick={() => setPending(volunteer.id)}>
            Remove from this browser
          </button>
        )}
      </li>
    );
  }

  return (
    <section id="people" className="panel" aria-labelledby="people-title">
      <div className="section-head section-head-row">
        <div>
          <p className="index">{event.mode === "work" ? "05" : "04"}</p>
          <h2 id="people-title">Who has offered time</h2>
          <p>
            Names marked Example are sample people, so the chart is not empty before anyone types a name. Hide them
            when you want the picture to show only hours saved in this browser.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          aria-pressed={!examplesHidden}
          onClick={() => onToggleExamples(!examplesHidden)}
        >
          {examplesHidden ? "Show examples" : "Hide examples"}
        </button>
      </div>
      {people.length === 0 && (
        <p className="quiet">No one has added hours in this browser yet.</p>
      )}
      {people.length > 0 && (
        <>
          <h3 className="subhead">On this device</h3>
          <ul className="people">{people.map(renderPerson)}</ul>
        </>
      )}
      {examples.length > 0 && (
        <>
          <h3 className="subhead">Examples</h3>
          <ul className="people">{examples.map(renderPerson)}</ul>
        </>
      )}
      {examplesHidden && examples.length === 0 && (
        <p className="quiet">Example people are hidden.</p>
      )}
    </section>
  );
}
