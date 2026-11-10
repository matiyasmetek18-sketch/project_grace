// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AvailabilityPage } from "./AvailabilityPage";

type Call = { url: string; method: string; body: string };

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
      const call = {
        url,
        method: (init?.method ?? "GET").toUpperCase(),
        body: typeof init?.body === "string" ? init.body : "",
      };
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
    expect(await screen.findByText(/has not confirmed it yet/, { selector: "#save-live" })).toBeTruthy();
    expect(screen.queryByText(/was not sent/)).toBeNull();
    expect(calls.filter((call) => call.method === "POST")).toHaveLength(1);
  });

  it("lets a rejected save be tried again", async () => {
    let posts = 0;
    mockBin((call) => {
      if (call.method === "GET") return json([]);
      posts += 1;
      if (posts === 1) return json({}, 500);
      return json({
        _id: "nia",
        name: "Nia",
        note: "",
        ranges: [{ date: "2026-11-10", start: "08:00", end: "12:00" }],
        createdAt: "2026-11-01T00:00:00.000Z",
      });
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
    expect(await screen.findByText(/Thank you, Nia/, { selector: "#save-live" })).toBeTruthy();
    expect(posts).toBe(2);
  });

  it("keeps other answers when a save finishes during the first load", async () => {
    const first = defer<Response>();
    let gets = 0;
    mockBin((call) => {
      if (call.method === "GET") {
        gets += 1;
        if (gets === 1) return first.promise;
        return json([{ _id: "ada", name: "Ada", note: "", ranges: [range], createdAt: "2026-11-01T00:00:00.000Z" }]);
      }
      return json({});
    });
    render(<AvailabilityPage />);
    fillHours();
    fireEvent.click(screen.getByRole("button", { name: "Share when I can come" }));
    expect(await screen.findByRole("heading", { name: "Ada" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Nia/ })).toBeTruthy();
    await act(async () => {
      first.resolve(
        json([
          {
            _id: "ghost",
            name: "Ghost",
            note: "",
            ranges: [range],
            createdAt: "2026-11-01T00:00:00.000Z",
          },
        ]),
      );
      await first.promise;
    });
    expect(screen.getByRole("heading", { name: "Ada" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Nia/ })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Ghost" })).toBeNull();
    expect(gets).toBeGreaterThan(1);
  });

  it("keeps a failed load visible until the refetch after a save returns the full list", async () => {
    let gets = 0;
    const refetch = defer<Response>();
    mockBin((call) => {
      if (call.method === "GET") {
        gets += 1;
        if (gets === 1) return json({ message: "no" }, 500);
        return refetch.promise;
      }
      return json({
        _id: "nia",
        name: "Nia",
        note: "",
        ranges: [{ date: "2026-11-10", start: "08:00", end: "12:00" }],
        createdAt: "2026-11-01T00:00:00.000Z",
      });
    });
    render(<AvailabilityPage />);
    expect(await screen.findByText("The shared list did not load.")).toBeTruthy();
    fillHours();
    fireEvent.click(screen.getByRole("button", { name: "Share when I can come" }));
    expect(await screen.findByText(/Thank you, Nia/, { selector: "#save-live" })).toBeTruthy();
    expect(screen.getByText("The shared list did not load.")).toBeTruthy();
    refetch.resolve(
      json([
        { _id: "ada", name: "Ada", note: "", ranges: [range], createdAt: "2026-11-01T00:00:00.000Z" },
        {
          _id: "nia",
          name: "Nia",
          note: "",
          ranges: [{ date: "2026-11-10", start: "08:00", end: "12:00" }],
          createdAt: "2026-11-01T00:00:00.000Z",
        },
      ]),
    );
    expect(await screen.findByRole("heading", { name: "Ada" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Nia" })).toBeTruthy();
    expect(screen.queryByText("The shared list did not load.")).toBeNull();
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

  it("rejects a past day", async () => {
    mockBin(() => json([]));
    render(<AvailabilityPage />);
    const input = screen.getByLabelText("Day you can come");
    expect(input.getAttribute("min")).toBe("2026-11-10");
    fireEvent.change(input, { target: { value: "2026-11-09" } });
    fireEvent.click(screen.getByRole("button", { name: "Add this day" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/already passed/);
  });

  it("moves focus to the thank-you message after a save", async () => {
    mockBin((call) =>
      call.method === "GET"
        ? json([])
        : json({
            _id: "nia",
            name: "Nia",
            note: "",
            ranges: [{ date: "2026-11-10", start: "08:00", end: "12:00" }],
            createdAt: "2026-11-01T00:00:00.000Z",
          }),
    );
    render(<AvailabilityPage />);
    expect(await screen.findByText("No one has added a time yet.")).toBeTruthy();
    fillHours();
    fireEvent.click(screen.getByRole("button", { name: "Share when I can come" }));
    expect(await screen.findByText(/Thank you, Nia/, { selector: "#save-live" })).toBeTruthy();
    expect(document.activeElement?.id).toBe("thanks");
    expect(document.getElementById("thanks")?.getAttribute("role")).toBeNull();
    expect(document.getElementById("thanks")?.getAttribute("aria-hidden")).toBe("true");
    expect(document.getElementById("save-live")?.textContent).toMatch(/Thank you, Nia/);
    expect(document.getElementById("save-live")?.getAttribute("role")).toBe("status");
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
    expect(await screen.findByText(/confirmed it yet|Thank you, Nia/, { selector: "#save-live" })).toBeTruthy();
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
    expect(document.activeElement).toBe(document.getElementById("saved-title"));
    expect(screen.getByText(/No overlapping time yet/)).toBeTruthy();
    expect(screen.queryByText(/second person/)).toBeNull();
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
    expect(await screen.findByText("Removed Ada")).toBeTruthy();
  });

  it("removes a server answer locally when delete returns 404", async () => {
    let gets = 0;
    mockBin((call) => {
      if (call.method === "DELETE") return new Response(null, { status: 404 });
      gets += 1;
      return json(gets === 1 ? [ada] : []);
    });
    render(<AvailabilityPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Remove Ada" }));
    fireEvent.click(within(await screen.findByRole("dialog", { name: "Remove Ada?" })).getByRole("button", { name: "Remove Ada" }));
    expect(await screen.findByText(/already removed/)).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Ada" })).toBeNull();
    expect(gets).toBeGreaterThan(1);
  });

  it("does not apply an older list response after a successful submit", async () => {
    const first = defer<Response>();
    let gets = 0;
    mockBin((call) => {
      if (call.method === "GET") {
        gets += 1;
        if (gets === 1) return first.promise;
        return json([
          { _id: "ada", name: "Ada", note: "", ranges: [range], createdAt: "2026-11-01T00:00:00.000Z" },
          {
            _id: "nia-server",
            name: "Nia",
            note: "",
            ranges: [{ date: "2026-11-10", start: "08:00", end: "12:00" }],
            createdAt: "2026-11-01T00:00:00.000Z",
          },
        ]);
      }
      return json({
        _id: "nia-server",
        name: "Nia",
        note: "",
        ranges: [{ date: "2026-11-10", start: "08:00", end: "12:00" }],
        createdAt: "2026-11-01T00:00:00.000Z",
      });
    });
    render(<AvailabilityPage />);
    fillHours();
    fireEvent.click(screen.getByRole("button", { name: "Share when I can come" }));
    expect(await screen.findByRole("heading", { name: "Ada" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Nia" })).toBeTruthy();
    await act(async () => {
      first.resolve(json([]));
      await first.promise;
    });
    expect(screen.getByRole("heading", { name: "Nia" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Ada" })).toBeTruthy();
  });

  it("shows the validator message when a chosen day is past at submit", async () => {
    let posts = 0;
    mockBin((call) => {
      if (call.method === "POST") {
        posts += 1;
        return json({ ok: true });
      }
      return json([]);
    });
    render(<AvailabilityPage />);
    expect(await screen.findByText("No one has added a time yet.")).toBeTruthy();
    fillHours();
    vi.setSystemTime(new Date(2026, 10, 11, 12, 0, 0));
    fireEvent.click(screen.getByRole("button", { name: "Share when I can come" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/already passed/);
    expect(screen.queryByText(/was not sent/)).toBeNull();
    expect(posts).toBe(0);
  });

  it("says the answer was sent but not confirmed when the list does not include it", async () => {
    mockBin((call) => {
      if (call.method === "GET") return json({ message: "down" }, 503);
      return json({ ok: true });
    });
    render(<AvailabilityPage />);
    fillHours();
    fireEvent.click(screen.getByRole("button", { name: "Share when I can come" }));
    expect(await screen.findByText(/has not confirmed it yet/, { selector: "#save-live" })).toBeTruthy();
    expect(screen.queryByText(/Thank you, Nia/)).toBeNull();
    expect(screen.getByRole("heading", { name: /Nia/ })).toBeTruthy();
    expect(screen.queryByText(/was not sent/)).toBeNull();
  });

  it("requests the list once after a save that does not echo the record", async () => {
    let gets = 0;
    mockBin((call) => {
      if (call.method === "GET") {
        gets += 1;
        return json([]);
      }
      return json({ ok: true });
    });
    render(<AvailabilityPage />);
    expect(await screen.findByText("No one has added a time yet.")).toBeTruthy();
    const before = gets;
    fillHours();
    fireEvent.click(screen.getByRole("button", { name: "Share when I can come" }));
    await screen.findByText(/has not confirmed it yet/, { selector: "#save-live" });
    expect(gets - before).toBe(1);
  });

  it("keeps a saved answer until a refetch includes its id", async () => {
    let gets = 0;
    mockBin((call) => {
      if (call.method === "GET") {
        gets += 1;
        if (gets === 1) return json([]);
        return json([{ _id: "ada", name: "Ada", note: "", ranges: [range], createdAt: "2026-11-01T00:00:00.000Z" }]);
      }
      return json({
        _id: "nia-server",
        name: "Nia",
        note: "",
        ranges: [{ date: "2026-11-10", start: "08:00", end: "12:00" }],
        createdAt: "2026-11-01T00:00:00.000Z",
      });
    });
    render(<AvailabilityPage />);
    expect(await screen.findByText("No one has added a time yet.")).toBeTruthy();
    fillHours();
    fireEvent.click(screen.getByRole("button", { name: "Share when I can come" }));
    expect(await screen.findByRole("heading", { name: "Ada" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Nia" })).toBeTruthy();
  });

  it("shows loading instead of the second-person note while the first list is still out", async () => {
    const pendingGets: Array<(value: Response) => void> = [];
    mockBin((call) => {
      if (call.method === "GET") {
        return new Promise<Response>((resolve) => {
          pendingGets.push(resolve);
        });
      }
      return json({
        _id: "nia-server",
        name: "Nia",
        note: "",
        ranges: [{ date: "2026-11-10", start: "08:00", end: "12:00" }],
        createdAt: "2026-11-01T00:00:00.000Z",
      });
    });
    render(<AvailabilityPage />);
    expect(screen.getByText("Loading answers…")).toBeTruthy();
    fillHours();
    fireEvent.click(screen.getByRole("button", { name: "Share when I can come" }));
    expect(await screen.findByRole("heading", { name: "Nia" })).toBeTruthy();
    expect(screen.getByText("Loading answers…")).toBeTruthy();
    expect(screen.queryByText(/second person/)).toBeNull();
    for (const resolve of pendingGets) {
      resolve(json([{ _id: "ada", name: "Ada", note: "", ranges: [range], createdAt: "2026-11-01T00:00:00.000Z" }]));
    }
    expect(await screen.findByRole("heading", { name: "Ada" })).toBeTruthy();
  });

  it("keeps focus on the dialog title while a delete is in flight", async () => {
    const pending = defer<Response>();
    mockBin((call) => (call.method === "DELETE" ? pending.promise : json([ada])));
    render(<AvailabilityPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Remove Ada" }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Remove Ada" }));
    expect(document.activeElement?.id).toBe("remove-title");
    pending.resolve(new Response(null, { status: 200 }));
  });

  it("keeps the removed announcement until the next action", async () => {
    mockBin((call) => (call.method === "DELETE" ? new Response(null, { status: 200 }) : json([ada])));
    render(<AvailabilityPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Remove Ada" }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Remove Ada" }));
    expect(await screen.findByText("Removed Ada")).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(screen.getByText("Removed Ada")).toBeTruthy();
  });

  it("announces already removed only once", async () => {
    let gets = 0;
    mockBin((call) => {
      if (call.method === "DELETE") return new Response(null, { status: 404 });
      gets += 1;
      return json(gets === 1 ? [ada] : []);
    });
    render(<AvailabilityPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Remove Ada" }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Remove Ada" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/already removed/);
    await new Promise((resolve) => setTimeout(resolve, 80));
    const inStatus = screen.queryAllByRole("status").some((element) => element.textContent?.includes("already removed"));
    expect(inStatus).toBe(false);
    expect(screen.getAllByText(/already removed/)).toHaveLength(1);
  });

  it("does not move focus when a later reload confirms the save", async () => {
    const refetch = defer<Response>();
    let gets = 0;
    let postedAt = "";
    mockBin((call) => {
      if (call.method === "GET") {
        gets += 1;
        if (gets === 1) return json([]);
        return refetch.promise;
      }
      postedAt = JSON.parse(call.body || "{}").createdAt ?? "";
      return json({ ok: true });
    });
    render(<AvailabilityPage />);
    expect(await screen.findByText("No one has added a time yet.")).toBeTruthy();
    fillHours();
    fireEvent.click(screen.getByRole("button", { name: "Share when I can come" }));
    expect(await screen.findByText(/has not confirmed it yet/, { selector: "#save-live" })).toBeTruthy();
    await waitFor(() => expect(document.activeElement?.id).toBe("save-unconfirmed"));
    screen.getByLabelText("Your name").focus();
    refetch.resolve(
      json([
        {
          _id: "nia-server",
          name: "Nia",
          note: "",
          ranges: [{ date: "2026-11-10", start: "08:00", end: "12:00" }],
          createdAt: postedAt,
        },
      ]),
    );
    expect(await screen.findByText(/Thank you, Nia/, { selector: "#save-live" })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText("Your name"));
  });

  it("keeps tab inside the dialog while a delete is in flight", async () => {
    const pending = defer<Response>();
    mockBin((call) => (call.method === "DELETE" ? pending.promise : json([ada])));
    render(<AvailabilityPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Remove Ada" }));
    const dialog = await screen.findByRole("dialog");
    const buttons = within(dialog).getAllByRole("button");
    fireEvent.click(buttons[1]);
    expect(buttons.every((button) => (button as HTMLButtonElement).disabled === false)).toBe(true);
    expect(buttons.every((button) => button.getAttribute("aria-disabled") === "true")).toBe(true);
    buttons[1].focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(document.body);
    pending.resolve(new Response(null, { status: 200 }));
  });

  function commonText(): string {
    return document.getElementById("common-title")?.parentElement?.textContent ?? "";
  }

  const overlap = { date: "2026-11-10", start: "08:00", end: "12:00" };

  function listed(id: string, name: string, createdAt = "2026-11-01T00:00:00.000Z") {
    return { _id: id, name, note: "", ranges: [overlap], createdAt };
  }

  it("does not count a pending save in common times during a slow reload", async () => {
    const refetch = defer<Response>();
    let gets = 0;
    mockBin((call) => {
      if (call.method === "GET") {
        gets += 1;
        if (gets === 1) return json([listed("ada", "Ada")]);
        return refetch.promise;
      }
      return json({ ok: true });
    });
    render(<AvailabilityPage />);
    expect(await screen.findByRole("heading", { name: "Ada" })).toBeTruthy();
    fillHours();
    fireEvent.click(screen.getByRole("button", { name: "Share when I can come" }));
    expect(await screen.findByRole("heading", { name: /Nia/ })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Nia/ }).textContent).toMatch(/Not confirmed yet/);
    expect(commonText()).not.toMatch(/2 people/);
    expect(commonText()).not.toMatch(/Nia/);
    refetch.resolve(json([listed("ada", "Ada")]));
  });

  it("counts a save in common times only after a later reload confirms it", async () => {
    const refetch = defer<Response>();
    let gets = 0;
    let postedAt = "";
    mockBin((call) => {
      if (call.method === "GET") {
        gets += 1;
        if (gets === 1) return json([listed("ada", "Ada")]);
        return refetch.promise;
      }
      postedAt = JSON.parse(call.body || "{}").createdAt ?? "";
      return json({ ok: true });
    });
    render(<AvailabilityPage />);
    expect(await screen.findByRole("heading", { name: "Ada" })).toBeTruthy();
    fillHours();
    fireEvent.click(screen.getByRole("button", { name: "Share when I can come" }));
    expect(await screen.findByText(/Not confirmed yet/)).toBeTruthy();
    expect(commonText()).not.toMatch(/Nia/);
    refetch.resolve(json([listed("ada", "Ada"), listed("nia-server", "Nia", postedAt)]));
    expect(await screen.findByText(/2 people/)).toBeTruthy();
    expect(commonText()).toMatch(/Nia/);
    expect(screen.getByRole("heading", { name: "Nia" }).textContent).not.toMatch(/Not confirmed yet/);
  });

  it("counts only confirmed answers when two people save at the same time", async () => {
    const refetch = defer<Response>();
    let gets = 0;
    mockBin((call) => {
      if (call.method === "GET") {
        gets += 1;
        if (gets === 1) return json([listed("ada", "Ada")]);
        return refetch.promise;
      }
      return json({ ok: true });
    });
    render(<AvailabilityPage />);
    expect(await screen.findByRole("heading", { name: "Ada" })).toBeTruthy();
    fillHours();
    fireEvent.click(screen.getByRole("button", { name: "Share when I can come" }));
    expect(await screen.findByText(/Not confirmed yet/)).toBeTruthy();
    refetch.resolve(json([listed("ada", "Ada"), listed("bo", "Bo")]));
    expect(await screen.findByRole("heading", { name: "Bo" })).toBeTruthy();
    expect(commonText()).toMatch(/2 people/);
    expect(commonText()).toMatch(/Ada/);
    expect(commonText()).toMatch(/Bo/);
    expect(commonText()).not.toMatch(/Nia/);
    expect(screen.getByRole("heading", { name: /Nia/ }).textContent).toMatch(/Not confirmed yet/);
  });

  it("keeps common times on the newer confirmed list when an older response arrives later", async () => {
    const older = defer<Response>();
    const newer = defer<Response>();
    let gets = 0;
    mockBin((call) => {
      if (call.method === "GET") {
        gets += 1;
        if (gets === 1) return json([listed("ada", "Ada")]);
        if (gets === 2) return older.promise;
        return newer.promise;
      }
      return json({ ok: true });
    });
    render(<AvailabilityPage />);
    expect(await screen.findByRole("heading", { name: "Ada" })).toBeTruthy();
    fillHours();
    fireEvent.click(screen.getByRole("button", { name: "Share when I can come" }));
    expect(await screen.findByText(/Not confirmed yet/)).toBeTruthy();
    document.dispatchEvent(new Event("visibilitychange"));
    newer.resolve(json([listed("ada", "Ada")]));
    expect(await screen.findByText(/has not confirmed it yet/, { selector: "#save-live" })).toBeTruthy();
    await act(async () => {
      older.resolve(json([listed("ada", "Ada"), listed("ghost", "Ghost")]));
      await older.promise;
    });
    expect(screen.queryByRole("heading", { name: "Ghost" })).toBeNull();
    expect(commonText()).not.toMatch(/Nia/);
    expect(commonText()).not.toMatch(/Ghost/);
    expect(commonText()).not.toMatch(/2 people/);
  });

  it("drops a confirmed answer another person deletes while yours is still pending", async () => {
    const refetch = defer<Response>();
    let gets = 0;
    mockBin((call) => {
      if (call.method === "GET") {
        gets += 1;
        if (gets === 1) return json([listed("ada", "Ada"), listed("bo", "Bo")]);
        return refetch.promise;
      }
      return json({ ok: true });
    });
    render(<AvailabilityPage />);
    expect(await screen.findByRole("heading", { name: "Ada" })).toBeTruthy();
    fillHours();
    fireEvent.click(screen.getByRole("button", { name: "Share when I can come" }));
    expect(await screen.findByText(/Not confirmed yet/)).toBeTruthy();
    refetch.resolve(json([listed("bo", "Bo")]));
    expect(await screen.findByRole("heading", { name: "Bo" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Ada" })).toBeNull();
    expect(screen.getByRole("heading", { name: /Nia/ }).textContent).toMatch(/Not confirmed yet/);
    expect(commonText()).not.toMatch(/Nia/);
    expect(commonText()).not.toMatch(/Ada/);
    expect(commonText()).not.toMatch(/2 people/);
  });

  it("uses the bars copy when one person is on the list", async () => {
    mockBin(() => json([ada]));
    render(<AvailabilityPage />);
    expect(await screen.findByRole("heading", { name: "Ada" })).toBeTruthy();
    expect(screen.getByText(/No overlapping time yet. The bars below show/)).toBeTruthy();
    expect(screen.queryByText(/second person/)).toBeNull();
    expect(document.querySelector(".flow-band")).toBeTruthy();
  });

  it("shows a waiting line while common times load and a failure line when they do not", async () => {
    const first = defer<Response>();
    mockBin(() => first.promise);
    render(<AvailabilityPage />);
    expect(screen.getByText("Waiting for the shared list.")).toBeTruthy();
    expect(screen.queryByText(/second person/)).toBeNull();
    expect(screen.queryByText(/No overlapping time yet/)).toBeNull();
    first.resolve(json({ message: "no" }, 500));
    expect(await screen.findByText("Common times could not load.")).toBeTruthy();
    expect(screen.queryByText("Waiting for the shared list.")).toBeNull();
  });

  it("tags an unconfirmed answer and checks the list again without counting it early", async () => {
    const slow = defer<Response>();
    let gets = 0;
    let postedAt = "";
    mockBin((call) => {
      if (call.method === "GET") {
        gets += 1;
        if (gets === 1) return json([listed("ada", "Ada")]);
        if (gets === 2) return slow.promise;
        return json([listed("ada", "Ada"), listed("nia", "Nia", postedAt)]);
      }
      postedAt = JSON.parse(call.body || "{}").createdAt ?? "";
      return json({ ok: true });
    });
    render(<AvailabilityPage />);
    expect(await screen.findByRole("heading", { name: "Ada" })).toBeTruthy();
    fillHours();
    fireEvent.click(screen.getByRole("button", { name: "Share when I can come" }));
    const heading = await screen.findByRole("heading", { name: /Nia/ });
    expect(heading.textContent).toMatch(/Not confirmed yet/);
    expect(heading.closest("li")?.classList.contains("is-pending")).toBe(true);
    expect(commonText()).not.toMatch(/Nia/);
    const before = gets;
    fireEvent.click(screen.getByRole("button", { name: "Check again" }));
    expect(await screen.findByRole("heading", { name: "Nia" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Nia" }).textContent).not.toMatch(/Not confirmed yet/);
    expect(commonText()).toMatch(/Nia/);
    expect(commonText()).toMatch(/2 people/);
    expect(gets).toBeGreaterThan(before);
    await act(async () => {
      slow.resolve(json([listed("ada", "Ada"), listed("ghost", "Ghost")]));
      await slow.promise;
    });
    expect(screen.queryByRole("heading", { name: "Ghost" })).toBeNull();
  });
});
