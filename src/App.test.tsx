// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import App from "./App";

afterEach(() => {
  cleanup();
});

function mockEmptyList() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (!url.includes("dontlosedata.site")) throw new Error(`unexpected fetch ${url}`);
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
}

it("shows the form on the home page", async () => {
  mockEmptyList();
  window.history.pushState({}, "", "/project_grace/");
  render(<App />);
  expect(await screen.findByRole("heading", { name: "When can you come?" })).toBeTruthy();
  expect(document.getElementById("main")?.getAttribute("tabindex")).toBe("-1");
});

it("shows a not-found state for an unknown path", async () => {
  mockEmptyList();
  window.history.pushState({}, "", "/project_grace/missing");
  render(<App />);
  expect(screen.getByRole("heading", { name: "That page is not here." })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "When can you come?" })).toBeNull();
  expect(screen.getByRole("link", { name: "Back to the home page" }).getAttribute("href")).toContain("/project_grace");
  fireEvent.click(screen.getByRole("link", { name: "Back to the home page" }));
  expect(await screen.findByRole("heading", { name: "When can you come?" })).toBeTruthy();
});
