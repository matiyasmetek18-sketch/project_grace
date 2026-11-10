import { commonSpans, coverageSpans, type Answer } from "../lib/commonTimes";
import { formatFullDate, formatTime, minutes } from "../lib/time";

const AXIS_START = 7 * 60;
const AXIS_END = 21 * 60;
const AXIS_SPAN = AXIS_END - AXIS_START;

function leftOf(hhmm: string): number {
  return ((Math.min(AXIS_END, Math.max(AXIS_START, minutes(hhmm))) - AXIS_START) / AXIS_SPAN) * 100;
}

function widthOf(start: string, end: string): number {
  return Math.max(0, leftOf(end) - leftOf(start));
}

export function CommonTimes({
  answers,
  status = "ready",
}: {
  answers: Answer[];
  status?: "loading" | "error" | "ready";
}) {
  const covered = coverageSpans(answers);
  const shared = commonSpans(answers);
  const dates = [...new Set(covered.map((span) => span.date))];
  const waiting = status !== "ready";

  return (
    <section className="common" aria-labelledby="common-title">
      <h2 id="common-title">Common times</h2>
      {answers.length < 2 ? (
        waiting ? null : <p>When a second person adds a time, the stretches you share will show up here.</p>
      ) : shared.length === 0 ? (
        <p>No overlapping time yet. The bars below show when each person can come.</p>
      ) : (
        <ol className="common-list">
          {shared.slice(0, 4).map((span) => (
            <li key={`${span.date}-${span.start}-${span.names.join()}`}>
              <strong>
                {span.names.length} people · {formatTime(span.start)} – {formatTime(span.end)}
              </strong>
              <span>
                {formatFullDate(span.date)}. {span.names.join(", ")}.
              </span>
            </li>
          ))}
        </ol>
      )}
      {dates.length > 0 && (
        <div className="flow">
          {dates.map((date) => {
            const spans = covered.filter((span) => span.date === date);
            const label = spans
              .map((span) => `${formatTime(span.start)} to ${formatTime(span.end)}, ${span.names.join(", ")}`)
              .join(". ");
            return (
              <div key={date} className="flow-day">
                <h3>{formatFullDate(date)}</h3>
                <div className="flow-track" role="img" aria-label={label}>
                  {spans.map((span) => (
                    <span
                      key={`${span.start}-${span.end}-${span.names.join()}`}
                      className="flow-band"
                      data-count={Math.min(span.names.length, 4)}
                      style={{ left: `${leftOf(span.start)}%`, width: `${widthOf(span.start, span.end)}%` }}
                    />
                  ))}
                </div>
                <div className="flow-axis" aria-hidden="true">
                  <span>7a</span>
                  <span>12p</span>
                  <span>4p</span>
                  <span>9p</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
