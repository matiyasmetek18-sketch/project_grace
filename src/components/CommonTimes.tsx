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
  const marks = [
    { label: "7a", at: 0 },
    { label: "12p", at: leftOf("12:00") },
    { label: "4p", at: leftOf("16:00") },
    { label: "9p", at: 100 },
  ];
  const summary =
    status === "loading"
      ? "Waiting for the shared list."
      : status === "error"
        ? "Common times could not load."
        : answers.length === 0
          ? "When a second person adds a time, the stretches you share will show up here."
          : shared.length === 0
            ? "No overlapping time yet. The bars below show when each person can come."
            : "";

  return (
    <section className="common" aria-labelledby="common-title">
      <h2 id="common-title">Common times</h2>
      {summary ? (
        <p>{summary}</p>
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
          <ul className="flow-legend">
            <li>
              <span className="flow-swatch" data-count="1" aria-hidden="true" />1 person
            </li>
            <li>
              <span className="flow-swatch" data-count="2" aria-hidden="true" />2 people
            </li>
            <li>
              <span className="flow-swatch" data-count="3" aria-hidden="true" />
              3+ people
            </li>
          </ul>
          {dates.map((date) => {
            const spans = covered.filter((span) => span.date === date);
            const label = spans
              .map((span) => `${formatTime(span.start)} to ${formatTime(span.end)}, ${span.names.join(", ")}`)
              .join(". ");
            return (
              <div key={date} className="flow-day">
                <h3>{formatFullDate(date)}</h3>
                <div className="flow-scale">
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
                    {marks.map((mark) => (
                      <span key={mark.label} style={{ left: `${mark.at}%` }}>
                        {mark.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
