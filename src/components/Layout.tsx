import { Link, Outlet } from "react-router-dom";
import { Mark } from "./Mark";

export function Layout() {
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <div className="wrap topbar-inner">
          <Link to="/" className="brand">
            <Mark />
            <span>Grace</span>
          </Link>
        </div>
      </header>
      <main id="main">
        <Outlet />
      </main>
      <footer className="footer">
        <div className="wrap">
          <p className="footer-mark">Grace</p>
          <p>What you add stays in this browser. A refresh keeps it. No account is required.</p>
        </div>
      </footer>
    </>
  );
}
