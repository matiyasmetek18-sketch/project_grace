import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { AvailabilityPage } from "./pages/AvailabilityPage";
import { NotFoundPage } from "./pages/NotFoundPage";

const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || undefined;

export default function App() {
  return (
    <BrowserRouter basename={basename}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<AvailabilityPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
