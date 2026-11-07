import { useState } from "react";
import type { Gathering, Task, TaskStatus, Volunteer } from "../types";
import { areaPull, peopleWord } from "../lib/overlap";

export function TaskBoard({
  event,
  volunteers,
  statusOf,
  onStatus,
}: {
  event: Gathering;
  volunteers: Volunteer[];
  statusOf: (taskId: string) => TaskStatus;
  onStatus: (taskId: string, status: TaskStatus) => void;
}) {
  const [editing, setEditing] = useState(false);
  const pull = areaPull(event, volunteers, statusOf);
  const interest = new Map(pull.areas.flatMap((area) => area.tasks.map((task) => [task.taskId, task] as const)));

  const open: Task[] = [];
  const later: Task[] = [];
  const done: Task[] = [];
  for (const task of event.tasks) {
    const status = statusOf(task.id);
    if (status === "done") done.push(task);
    else if (status === "later") later.push(task);
    else open.push(task);
  }

  const areas = event.areas
    .map((area) => ({ area, tasks: open.filter((task) => task.areaId === area.id) }))
    .filter((group) => group.tasks.length > 0);

  return (
    <section id="work" className="panel" aria-labelledby="work-title">
      <div className="section-head section-head-row">
        <div>
          <p className="index">03</p>
          <h2 id="work-title">Open work</h2>
          <p>Grouped by where the job sits. Updates you make stay in this browser.</p>
        </div>
        <button type="button" className="btn btn-ghost" aria-pressed={editing} onClick={() => setEditing((value) => !value)}>
          {editing ? "Done updating" : "Update what is still open"}
        </button>
      </div>

      <div className="task-board">
        {areas.map(({ area, tasks }) => (
          <article key={area.id} className="task-card">
            <header>
              <h3>{area.name}</h3>
              {area.blurb && <p>{area.blurb}</p>}
            </header>
            <ul>
              {tasks.map((task) => {
                const chosen = interest.get(task.id);
                return (
                  <li key={task.id}>
                    <div className="task-line">
                      <p>
                        {task.title}
                        {task.heft === "heavier" && <span className="heft">Heavier lift</span>}
                      </p>
                      <p className="task-count">{chosen && chosen.count > 0 ? peopleWord(chosen.count) : "No one yet"}</p>
                    </div>
                    {editing && (
                      <label className="status-label">
                        <span className="sr-only">Status of {task.title}</span>
                        <select
                          value={statusOf(task.id)}
                          onChange={(change) => onStatus(task.id, change.target.value as TaskStatus)}
                        >
                          <option value="open">Open</option>
                          <option value="done">Done — move off</option>
                          <option value="later">Waiting on the season</option>
                        </select>
                      </label>
                    )}
                  </li>
                );
              })}
            </ul>
          </article>
        ))}
      </div>

      {later.length > 0 && (
        <details className="held">
          <summary>Waiting on the season ({later.length})</summary>
          <ul>
            {later.map((task) => (
              <li key={task.id}>
                <span>{task.title}</span>
                {editing && (
                  <button type="button" className="text-btn" onClick={() => onStatus(task.id, "open")}>
                    Bring back
                  </button>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
      {done.length > 0 && (
        <details className="held">
          <summary>Moved off ({done.length})</summary>
          <ul>
            {done.map((task) => (
              <li key={task.id}>
                <span>{task.title}</span>
                {editing && (
                  <button type="button" className="text-btn" onClick={() => onStatus(task.id, "open")}>
                    Bring back
                  </button>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
