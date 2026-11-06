import { Link } from "react-router-dom";
import { useGatherings } from "../gatherings";
import { blockPhrase, buildOverlap } from "../lib/overlap";
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
      <section className="hero wrap">
        <div className="hero-copy">
          <p className="eyebrow">Community gatherings</p>
          <h1>Find the hour we can all show up.</h1>
          <p className="lede">
            Grace is a place to share when you are free, and which work you can take on. The overlap appears on its
            own: the best hours to gather, and the corners of a place people are drawn to.
          </p>
          <div className="hero-actions">
            <a className="btn btn-primary" href="#featured">
              See the work day
            </a>
            <Link className="btn btn-ghost" to="/events/new">
              Plan a gathering
            </Link>
          </div>
        </div>
        {featured && best && (
          <aside className="hero-card" aria-label="Strongest overlap on the featured gathering">
            <p className="eyebrow">On the work day</p>
            <p className="hero-card-date">{formatFullDate(best.date)}</p>
            <p className="hero-card-time">
              {formatTime(best.start)} – {formatTime(best.end)}
            </p>
            <p>{blockPhrase(best.people)}.</p>
            <Link to={`/events/${featured.id}#overlap`}>See the full overlap</Link>
          </aside>
        )}
        {featured && !best && (
          <aside className="hero-card">
            <p className="eyebrow">On the work day</p>
            <p className="hero-card-date">Hours will gather here</p>
            <p>Once people share when they can come, the strongest block shows on this card.</p>
            <Link to={`/events/${featured.id}#join`}>Add your hours</Link>
          </aside>
        )}
      </section>

      <section id="gatherings" className="wrap gatherings" aria-labelledby="gatherings-title">
        <div className="section-head">
          <p className="index">Gatherings</p>
          <h2 id="gatherings-title">More than one event can live here.</h2>
        </div>
        {featured && (
          <article className="feature" id="featured">
            <div>
              <p className="eyebrow">{featured.kicker}</p>
              <h3>{featured.title}</h3>
              <p className="feature-summary">{featured.summary}</p>
              <ul className="facts">
                <li>
                  <strong>
                    {formatMonthDay(featured.windowStart)} – {formatMonthDay(featured.windowEnd)}
                  </strong>
                  <span>
                    {formatTime(featured.dayStart)} – {formatTime(featured.dayEnd)}
                  </span>
                </li>
                <li>
                  <strong>{openCount}</strong>
                  <span>open tasks</span>
                </li>
                <li>
                  <strong>{featured.areas.length}</strong>
                  <span>areas of the grounds</span>
                </li>
              </ul>
              <div className="hero-actions">
                <Link className="btn btn-light" to={`/events/${featured.id}`}>
                  Open the work day
                </Link>
                <Link className="btn btn-line" to={`/events/${featured.id}#join`}>
                  Share your hours
                </Link>
              </div>
            </div>
            <ul className="area-pills" aria-label="Some of the work areas">
              {featured.areas.slice(0, 6).map((area) => (
                <li key={area.id}>{area.name}</li>
              ))}
            </ul>
          </article>
        )}
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

      <section className="wrap steps" aria-labelledby="steps-title">
        <h2 id="steps-title">How a gathering comes together</h2>
        <ol>
          <li>
            <span>1</span>
            <div>
              <h3>Share the hours you can give</h3>
              <p>Pick days the way you would on a calendar, then morning, afternoon, or the whole window.</p>
            </div>
          </li>
          <li>
            <span>2</span>
            <div>
              <h3>Choose the work, or the room</h3>
              <p>Tap an area of the grounds, a task, or the place you would like to meet.</p>
            </div>
          </li>
          <li>
            <span>3</span>
            <div>
              <h3>Read the overlap</h3>
              <p>The deepest color is the time most people share. The grounds fill in where hands are offered.</p>
            </div>
          </li>
        </ol>
      </section>
    </div>
  );
}
