import { describe, expect, it } from "vitest";
import pages from "../.github/workflows/pages.yml?raw";
import keep from "../.github/workflows/keep-shared-answers.yml?raw";
import ci from "../.github/workflows/ci.yml?raw";
import pkgRaw from "../package.json?raw";

describe("published facts", () => {
  it("pins the patched react-router-dom release and the jsdom node range", () => {
    const pkg = JSON.parse(pkgRaw) as { dependencies: Record<string, string>; engines: { node: string } };
    expect(pkg.dependencies["react-router-dom"]).toBe("7.18.5");
    expect(pkg.engines.node).toBe("^20.19.0 || ^22.13.0 || >=24.0.0");
  });

  it("deploys Pages only from main and checks pull requests without deploying", () => {
    expect(pages).toMatch(/branches:\s*\[main\]/);
    expect(pages).toContain("workflow_dispatch:");
    expect(pages).not.toContain("pull_request");
    expect(pages).toContain("contents: read");
    expect(pages).toContain("pages: write");
    expect(pages).toContain("id-token: write");
    expect(pages).toContain("actions/deploy-pages@v4");
    expect(pages).toContain("path: dist");
    const installAt = pages.indexOf("npm ci");
    const testAt = pages.indexOf("npm test");
    const buildAt = pages.indexOf("npm run build");
    expect(installAt).toBeGreaterThan(-1);
    expect(testAt).toBeGreaterThan(installAt);
    expect(buildAt).toBeGreaterThan(testAt);
    expect(pages).not.toContain("npm run typecheck");

    expect(keep).toContain("schedule:");
    expect(keep).toContain("workflow_dispatch:");
    expect(keep).not.toContain("push:");
    expect(keep).not.toContain("pull_request");

    expect(ci).toContain("pull_request:");
    expect(ci).toMatch(/push:[\s\S]*branches:\s*\[main\]/);
    expect(ci).toContain("contents: read");
    expect(ci).not.toContain("pages: write");
    expect(ci).not.toContain("deploy-pages");
    expect(ci).toContain("npm ci");
    expect(ci).toContain("npm test");
    expect(ci).toContain("npm run typecheck");
    expect(ci).toContain("npm run build");
    expect(ci.indexOf("npm test")).toBeLessThan(ci.indexOf("npm run build"));
  });
});
