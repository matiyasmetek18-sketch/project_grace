import { Link } from "react-router-dom";
import { useDocumentTitle } from "../useDocumentTitle";

export function NotFoundPage() {
  useDocumentTitle("Page not found — Grace");
  return (
    <div className="wrap missing">
      <h1>That page is not here.</h1>
      <p>The availability page is on the home page.</p>
      <Link className="btn btn-primary" to="/">
        Back to the home page
      </Link>
    </div>
  );
}
