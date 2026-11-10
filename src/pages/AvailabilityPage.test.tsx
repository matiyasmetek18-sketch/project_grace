// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AvailabilityPage } from "./AvailabilityPage";

type Call = { url: string; method: string };

const range = { date: "2026-11-13", start: "08:00", end: "12:00" };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function defer<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function mockBin(handler: (call: Call) => Promise<Response> | Response) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (!url.includes("dontlosedata.site")) throw new Error(`unexpected fetch ${url}`);
      const call = { url, method: (init?.method ?? "GET").toUpperCase() };
      calls.push(call);
      return handler(call);
    }),
  );
  return calls;
}

function ensureDialog() {
  const proto = HTMLDialogElement.prototype as HTMLDialogElement & {
    showModal?: (this: HTMLDialogElement) => void;
    close?: (this: HTMLDialogElement) => void;
  };
  if ((proto.showModal as { __grace?: boolean } | undefined)?.__grace) return;
  const nativeShow = proto.showModal;
  const nativeClose = proto.close;
  function showModal(this: HTMLDialogElement) {
    if (nativeShow) {
      try {
        nativeShow.call(this);
      } catch {
        this.setAttribute("open", "");
      }
    } else {
      this.setAttribute("open", "");
    }
    if (!this.open) this.setAttribute("open", "");
  }
  (showModal as { __grace?: boolean }).__grace = true;
  proto.showModal = showModal;
  proto.close = function close(this: HTMLDialogElement) {
    if (nativeClose) {
      try {
        nativeClose.call(this);
      } catch {
        this.removeAttribute("open");
      }
    }
    if (this.open) this.removeAttribute("open");
  };
}

function fillHours(name = "Nia") {
  fireEvent.change(screen.getByLabelText("Your name"), { target: { value: name } });
  fireEvent.click(screen.getByRole("button", { name: "Add this day" }));
  fireEvent.click(screen.getByRole("button", { name: /Morning/ }));
}

const ada = {
  _id: "server-1",
  id: "spoof-id",
  name: "Ada",
  note: "",
  ranges: [range],
  createdAt: "2026-11-01T00:00:00.000Z",
};

beforeEach(() => {
  ensureDialog();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 10, 12, 0, 0));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("availability page", () => {
  it("sends one POST when submit is repeated during a slow save", async () => {
    const post = defer<Response>();
    const calls = mockBin((call) => (call.method === "GET" ? json([]) : post.promise));
    render(<AvailabilityPage />);
    expect(await screen.findByText("No one has added a time yet.")).toBeTruthy();
    fillHours();
    const form = document.querySelector("form");
    if (!form) throw new Error("missing form");
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(calls.filter((call) => call.method === "POST")).toHaveLength(1);
    const sending = screen.getByRole("button", { name: "Sending…" }) as HTMLButtonElement;
    expect(sending.disabled).toBe(true);
    post.resolve(json({}));
    expect(await screen.findByText(/Thank you, Nia/)).toBeTruthy();
    expect(screen.queryByText(/was not sent/)).toBeNull();
    expect(calls.filter((call) => call.method === "POST")).toHaveLength(1);
  });

  it("lets a rejected save be tried again", async () => {
    let posts = 0;
    mockBin((call) => {
      if (call.method === "GET") return json([]);
      posts += 1;
      return json({}, posts === 1 ? 500 : 200);
    });
    render(<AvailabilityPage />);
    expect(await screen.findByText("No one has added a time yet.")).toBeTruthy();
    fillHours();
    const form = document.querySelector("form");
    if (!form) throw new Error("missing form");
    fireEvent.submit(form);
    expect((await screen.findByRole("alert")).textContent).toMatch(/was not sent/);
    const retry = screen.getByRole("button", { name: "Share when I can come" }) as HTMLButtonElement;
    expect(retry.disabled).toBe(false);
    fireEvent.submit(form);
    expect(await screen.findByText(/Thank you, Nia/)).toBeTruthy();
    expect(posts).toBe(2);
  });

  it("does not apply an older list response after a successful submit", async () => {
    const first = defer<Response>();
    mockBin((call) => (call.method === "GET" ? first.promise : json({})));
    render(<AvailabilityPage />);
    fillHours();
    fireEvent.click(screen.getByRole("button", { name: "Share when I can come" }));
    expect(await screen.findByText(/Thank you, Nia/)).toBeTruthy();
    await act(async () => {
      first.resolve(
        json([
          {
            _id: "old",
            id: "spoof-id",
            name: "Old",
            note: "",
            ranges: [range],
            createdAt: "2020-01-01T00:00:00.000Z",
          },
        ]),
      );
      await first.promise;
    });
    expect(screen.getByRole("heading", { name: "Nia" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Old" })).toBeNull();
  });

  it("moves focus to the form error and describes the invalid field", async () => {
    mockBin(() => json([]));
    render(<AvailabilityPage />);
    fireEvent.click(screen.getByRole("button", { name: "Share when I can come" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/Add your name/);
    expect(document.activeElement).toBe(alert);
    const name = screen.getByLabelText("Your name");
    expect(name.getAttribute("aria-invalid")).toBe("true");
    expect(name.getAttribute("aria-describedby")).toBe("form-error");
  });

  it("shows one end-time error, connected to the end field", () => {
    mockBin(() => json([]));
    render(<AvailabilityPage />);
    fireEvent.change(screen.getByRole("combobox", { name: "End" }), { target: { value: "07:30" } });
    const messages = screen.getAllByText("The end needs to be later than the start.");
    expect(messages).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Add these hours" }));
    expect(screen.getAllByText("The end needs to be later than the start.")).toHaveLength(1);
    expect(document.activeElement).toBe(messages[0]);
    expect(screen.getByRole("combobox", { name: "End" }).getAttribute("aria-describedby")).toBe("hours-error");
  });

  it("rejects a past day and still rejects Sunday", async () => {
    mockBin(() => json([]));
    render(<AvailabilityPage />);
    const input = screen.getByLabelText("Day you can come");
    expect(input.getAttribute("min")).toBe("2026-11-10");
    fireEvent.change(input, { target: { value: "2026-11-09" } });
    fireEvent.click(screen.getByRole("button", { name: "Add this day" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/already passed/);
    fireEvent.change(screen.getByLabelText("Day you can come"), { target: { value: "2026-11-08" } });
    fireEvent.click(screen.getByRole("button", { name: "Add this day" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/Sundays are not on this list/);
  });

  it("clears a duplicate-day message that no longer applies", async () => {
    mockBin((call) => (call.method === "GET" ? json([]) : json({})));
    render(<AvailabilityPage />);
    expect(await screen.findByText("No one has added a time yet.")).toBeTruthy();
    fillHours();
    fireEvent.change(screen.getByLabelText("Choose another day"), { target: { value: "2026-11-10" } });
    fireEvent.click(screen.getByRole("button", { name: "Add this day" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/already on your list/);
    fireEvent.click(screen.getByRole("button", { name: "Remove Tuesday, November 10" }));
    expect(screen.queryByText(/already on your list/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Add this day" }));
    fireEvent.click(screen.getByRole("button", { name: /Morning/ }));
    fireEvent.change(screen.getByLabelText("Choose another day"), { target: { value: "2026-11-10" } });
    fireEvent.click(screen.getByRole("button", { name: "Add this day" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/already on your list/);
    fireEvent.click(screen.getByRole("button", { name: "Share when I can come" }));
    expect(await screen.findByText(/Thank you, Nia/)).toBeTruthy();
    expect(screen.queryByText(/already on your list/)).toBeNull();
  });

  it("does not show empty answers while the list is loading or after it fails", async () => {
    const first = defer<Response>();
    let attempt = 0;
    const calls = mockBin(() => {
      attempt += 1;
      if (attempt === 1) return first.promise;
      return json([ada]);
    });
    render(<AvailabilityPage />);
    expect(screen.getByText("Loading answers…")).toBeTruthy();
    expect(screen.queryByText(/No one has added a time yet/)).toBeNull();
    expect(screen.queryByText(/second person/)).toBeNull();
    first.resolve(json({ message: "no" }, 500));
    expect(await screen.findByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.queryByText(/No one has added a time yet/)).toBeNull();
    expect(screen.queryByText(/second person/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "Ada" })).toBeTruthy();
    expect(screen.getByText(/second person/)).toBeTruthy();
    expect(calls.filter((call) => call.method === "GET")).toHaveLength(2);
  });

  it("does not delete when removal is cancelled", async () => {
    const calls = mockBin(() => json([ada]));
    render(<AvailabilityPage />);
    const trigger = await screen.findByRole("button", { name: "Remove Ada" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole("dialog", { name: "Remove Ada?" });
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Remove Ada" })).toBeTruthy();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(calls.filter((call) => call.method === "DELETE")).toHaveLength(0);
    expect(document.activeElement).toBe(trigger);
    fireEvent.click(trigger);
    fireEvent.click(within(await screen.findByRole("dialog", { name: "Remove Ada?" })).getByRole("button", { name: "Cancel" }));
    expect(calls.filter((call) => call.method === "DELETE")).toHaveLength(0);
    expect(document.activeElement).toBe(trigger);
  });

  it("sends one delete for the server id when removal is confirmed", async () => {
    const pending = defer<Response>();
    const calls = mockBin((call) => (call.method === "DELETE" ? pending.promise : json([ada])));
    render(<AvailabilityPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Remove Ada" }));
    const dialog = await screen.findByRole("dialog", { name: "Remove Ada?" });
    const confirm = within(dialog).getByRole("button", { name: "Remove Ada" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(calls.filter((call) => call.method === "DELETE")).toHaveLength(1);
    const deletion = calls.find((call) => call.method === "DELETE");
    expect(deletion?.url).toContain("/id/server-1");
    expect(deletion?.url).not.toContain("spoof");
    pending.resolve(new Response(null, { status: 200 }));
    await pending.promise;
    expect(await screen.findByText("No one has added a time yet.")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Ada" })).toBeNull();
    expect(calls.filter((call) => call.method === "DELETE")).toHaveLength(1);
  });
});
