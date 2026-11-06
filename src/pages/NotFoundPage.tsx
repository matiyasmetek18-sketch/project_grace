import { Link } from "react-router-dom";
import { useDocumentTitle } from "../useDocumentTitle";

export function NotFoundPage() {
  useDocumentTitle("Not found — Grace");
  return (
    <div className="wrap missing">
      <h1>That page is not here.</h1>
      <p>The gatherings that are on this device are waiting on the home page.</p>
      <Link className="btn btn-primary" to="/">
        Back to gatherings
      </Link>
    </div>
  );
}
