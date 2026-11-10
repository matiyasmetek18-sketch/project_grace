import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readme = readFileSync("README.md", "utf8");
const css = readFileSync("src/styles.css", "utf8");
const pages = readFileSync(".github/workflows/pages.yml", "utf8");
const keep = readFileSync(".github/workflows/keep-shared-answers.yml", "utf8");
const pkgRaw = readFileSync("package.json", "utf8");

function contrast(foreground: string, background: string): number {
  const channel = (hex: string) => {
    const value = Number.parseInt(hex, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance = (hex: string) => {
    const raw = hex.replace("#", "");
    const red = channel(raw.slice(0, 2));
    const green = channel(raw.slice(2, 4));
    const blue = channel(raw.slice(4, 6));
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

describe("published facts", () => {
  it("pins the patched react-router-dom release", () => {
    const pkg = JSON.parse(pkgRaw) as { dependencies: Record<string, string> };
    expect(pkg.dependencies["react-router-dom"]).toBe("7.18.5");
  });

  it("runs tests and the type check before the Pages build without changing the deploy", () => {
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
    const typeAt = pages.indexOf("npm run typecheck");
    const buildAt = pages.indexOf("npm run build");
    expect(installAt).toBeGreaterThan(-1);
    expect(testAt).toBeGreaterThan(installAt);
    expect(typeAt).toBeGreaterThan(testAt);
    expect(buildAt).toBeGreaterThan(typeAt);

    expect(keep).toContain("schedule:");
    expect(keep).toContain("workflow_dispatch:");
    expect(keep).not.toContain("push:");
    expect(keep).not.toContain("pull_request");
  });

  it("describes the public list and does not claim answers are saved on the device", () => {
    expect(readme.toLowerCase()).not.toContain("saved on this device");
    expect(readme).not.toMatch(/node\.js 20/i);
    expect(readme).toContain("one public list");
    expect(readme).toContain("remove any answer");
    expect(readme).toContain("There are no accounts.");
    expect(readme).toContain("the whole list could be wiped");
    expect(readme).toContain("Do not enter sensitive information.");
    expect(readme).not.toContain("gathering link");
  });
});

describe("text contrast and motion", () => {
  it("keeps text shades at 4.5:1 and gives placeholders an existing dark shade", () => {
    expect(contrast("#1c1914", "#fffdf8")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#3a332b", "#fffdf8")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#4e463c", "#fffdf8")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#8a3828", "#fffdf8")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#8a3828", "#f8ebe6")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#6e2c1e", "#fffdf8")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#fffdf8", "#1b3326")).toBeGreaterThanOrEqual(4.5);
    expect(css).toMatch(/\.collector input::placeholder,\s*\.collector textarea::placeholder\s*\{[^}]*color:\s*#3a332b;/s);
    expect(css).toMatch(/\.collector textarea::placeholder\s*\{[^}]*opacity:\s*1;/s);
  });

  it("gives buttons a 44px target and stops the later flow animation when motion is reduced", () => {
    const textButtons = [...css.matchAll(/\.text-btn\s*\{([^}]*)\}/g)];
    expect(textButtons.some((match) => /min-height:\s*44px/.test(match[1]))).toBe(true);
    const skip = css.match(/\.skip\s*\{([^}]*)\}/);
    expect(skip?.[1]).toMatch(/min-height:\s*44px/);
    const flowAt = css.lastIndexOf("@keyframes flow-in");
    const motionAt = css.lastIndexOf("@media (prefers-reduced-motion: reduce)");
    expect(flowAt).toBeGreaterThan(-1);
    expect(motionAt).toBeGreaterThan(flowAt);
    expect(css.slice(motionAt)).toContain(".flow-band");
    expect(css.slice(motionAt)).toContain("animation: none");
  });
});
