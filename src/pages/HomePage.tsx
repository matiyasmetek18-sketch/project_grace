import { Link } from "react-router-dom";
import { useGatherings } from "../gatherings";
import { buildOverlap } from "../lib/overlap";
import { formatFullDate, formatMonthDay, formatTime, formatWindow } from "../lib/time";
import { useDocumentTitle } from "../useDocumentTitle";

export function HomePage() {
  useDocumentTitle("Grace — when we can gather");
  const { events, volunteersFor, taskStatus } = useGatherings();
  const featured = events.find((event) => event.featured) ?? events[0];
  const rest = events.filter((event) => event.id !== featured?.id);
  const featuredPeople = featured ? volunteersFor(featured) : [];
  const featuredOverlap = featured ? buildOverlap(featured, featuredPeople) : null;
  const best = featuredOverlap?.blocks[0];
  const openCount = featured
    ? featured.tasks.filter((task) => taskStatus(featured.id, task.id) === "open").length
    : 0;

  return (
    <div className="home">
      <section className="hero wrap home-hero">
        <p className="eyebrow">Outdoor work</p>
        <h1>{featured?.title ?? "Find the hour we can all show up."}</h1>
        <p className="lede">
          {featured
            ? `${featured.summary} Open it to see the tasks, add your hours, or look at when people overlap.`
            : "Share when you are free, and which work you can take on."}
        </p>
        {featured && best && (
          <p className="home-best">
            <span>Best shared time</span>
            {formatFullDate(best.date)} · {formatTime(best.start)} – {formatTime(best.end)}
          </p>
        )}
        {featured && (
          <p className="home-meta">
            {formatMonthDay(featured.windowStart)} – {formatMonthDay(featured.windowEnd)} · {openCount} open tasks
          </p>
        )}
        <div className="hero-actions">
          {featured ? (
            <Link className="btn btn-primary" to={`/events/${featured.id}`}>
              Open the work day
            </Link>
          ) : (
            <Link className="btn btn-primary" to="/events/new">
              Plan a gathering
            </Link>
          )}
        </div>
      </section>

      <section id="gatherings" className="wrap gatherings" aria-labelledby="gatherings-title">
        <h2 id="gatherings-title">Also on this device</h2>
        <div className="card-grid">
          {rest.map((event) => {
            const people = volunteersFor(event);
            const overlap = buildOverlap(event, people);
            const block = overlap.blocks[0];
            return (
              <article key={event.id} className={`event-card season-tint season-tint-${event.season}`}>
                <p className="eyebrow">{event.kicker}</p>
                <h3>{event.title}</h3>
                <p>{event.summary}</p>
                <p className="meta">
                  {formatWindow(event.windowStart, event.windowEnd)}
                  <span>
                    {formatTime(event.dayStart)} – {formatTime(event.dayEnd)}
                  </span>
                </p>
                {block && (
                  <p className="meta-strong">
                    {formatFullDate(block.date)} · {formatTime(block.start)} – {formatTime(block.end)}
                  </p>
                )}
                <Link className="text-link" to={`/events/${event.id}`}>
                  Open this gathering
                </Link>
              </article>
            );
          })}
          <Link className="event-card event-card-new" to="/events/new">
            <p className="eyebrow">On this device</p>
            <h3>Plan a gathering</h3>
            <p>Add a work day or a meet-up. People can share hours without an account.</p>
            <span className="text-link">Start one</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
