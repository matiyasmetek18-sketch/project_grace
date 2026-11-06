import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { GatheringsProvider } from "./gatherings";
import { EventPage } from "./pages/EventPage";
import { HomePage } from "./pages/HomePage";
import { NewEventPage } from "./pages/NewEventPage";
import { NotFoundPage } from "./pages/NotFoundPage";

const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || undefined;

export default function App() {
  return (
    <GatheringsProvider>
      <BrowserRouter basename={basename}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="events/new" element={<NewEventPage />} />
            <Route path="events/:eventId" element={<EventPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </GatheringsProvider>
  );
}
