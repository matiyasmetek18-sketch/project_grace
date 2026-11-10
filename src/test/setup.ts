import { afterEach, beforeEach, vi } from "vitest";

const LIVE_BIN = "dontlosedata.site";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes(LIVE_BIN)) {
        throw new Error(`Refusing to contact the live shared bin from a test: ${url}`);
      }
      throw new Error(`Unexpected fetch in test: ${url}`);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
