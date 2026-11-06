import { useEffect, useRef } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useGatherings } from "../gatherings";
import { Mark } from "./Mark";

function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const el = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (el) {
        el.scrollIntoView({ block: "start" });
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

export function Layout() {
  const { saveError, resetLocal } = useGatherings();
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <ScrollToTop />
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <div className="wrap topbar-inner">
          <NavLink to="/" className="brand" end>
            <Mark />
            <span>Grace</span>
          </NavLink>
          <nav className="topnav" aria-label="Primary">
            <NavLink to="/" end>
              Gatherings
            </NavLink>
            <NavLink to="/events/new" className="btn btn-small">
              Plan a gathering
            </NavLink>
          </nav>
        </div>
      </header>
      {saveError && (
        <div className="wrap">
          <p className="banner banner-warn" role="status">
            This browser did not keep the latest change. It will last until you close the page.
          </p>
        </div>
      )}
      <main id="main">
        <Outlet />
      </main>
      <footer className="footer">
        <div className="wrap footer-inner">
          <div>
            <p className="footer-mark">Grace</p>
            <p>
              Hours and gatherings you add stay in this browser. A refresh keeps them. Another phone has its own copy.
              No account is required.
            </p>
          </div>
          <div className="footer-actions">
            <button type="button" className="btn btn-ghost" onClick={() => dialogRef.current?.showModal()}>
              Clear this browser
            </button>
          </div>
        </div>
        <dialog ref={dialogRef} className="sheet" aria-labelledby="clear-title">
          <h2 id="clear-title">Clear hours saved in this browser?</h2>
          <p>
            This removes gatherings and hours added on this device, and brings the example people back. The original
            sample gatherings stay.
          </p>
          <form method="dialog" className="dialog-actions">
            <button type="submit" className="btn btn-primary" autoFocus>
              Keep
            </button>
            <button type="submit" className="btn btn-ghost" onClick={() => resetLocal()}>
              Clear this browser
            </button>
          </form>
        </dialog>
      </footer>
    </>
  );
}
