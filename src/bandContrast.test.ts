// Vitest runs in Node. The DOM lib used for typecheck does not include this builtin.
// @ts-expect-error node:fs is provided by the test runtime
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./styles.css", import.meta.url).pathname, "utf8");

const TRACK = [239, 230, 214];

function lin(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(rgb: number[]): number {
  return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
}

function contrast(a: number[], b: number[]): number {
  const left = luminance(a);
  const right = luminance(b);
  return (Math.max(left, right) + 0.05) / (Math.min(left, right) + 0.05);
}

function over(rgb: number[], alpha: number): number[] {
  return rgb.map((channel, index) => Math.round(channel * alpha + TRACK[index] * (1 - alpha)));
}

function block(count: string): string {
  const match = css.match(new RegExp(`\\.flow-band\\[data-count="${count}"\\][^{]*\\{[^}]*\\}`));
  if (!match) throw new Error(`missing band ${count}`);
  return match[0];
}

function fill(rule: string): number[] {
  const mixed = rule.match(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([0-9.]+)\s*\)/);
  if (mixed) return over([Number(mixed[1]), Number(mixed[2]), Number(mixed[3])], Number(mixed[4]));
  const hex = rule.match(/background:\s*#([0-9a-f]{6})/i);
  if (!hex) throw new Error(rule);
  const value = hex[1];
  return [0, 2, 4].map((start) => Number.parseInt(value.slice(start, start + 2), 16));
}

describe("timeline bands", () => {
  it("darkens monotonically and stays at least 3:1 on the track", () => {
    const one = fill(block("1"));
    const two = fill(block("2"));
    const three = fill(block("3"));
    expect(luminance(one)).toBeGreaterThan(luminance(two));
    expect(luminance(two)).toBeGreaterThan(luminance(three));
    expect(contrast(one, TRACK)).toBeGreaterThanOrEqual(3);
    expect(contrast(two, TRACK)).toBeGreaterThanOrEqual(3);
    expect(contrast(three, TRACK)).toBeGreaterThanOrEqual(3);
    expect(contrast(one, two)).toBeGreaterThanOrEqual(2.15);
    expect(contrast(two, three)).toBeGreaterThanOrEqual(2.15);
    expect(block("3")).toContain("#e6c27a");
    expect(block("3")).not.toMatch(/background:\s*#e6c27a/);
    expect(block("2")).toContain("box-shadow");
    expect(block("1")).not.toContain("#e6c27a");
  });
});
