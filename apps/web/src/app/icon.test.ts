import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The favicon is decoded as an image, not as HTML, so it has to be well-formed
 * XML. Nothing surfaces a breakage: the route still serves 200 image/svg+xml
 * and the browser just falls back to the default icon. The trap is a literal
 * "--" in a comment (easy to write when documenting the mochi properties),
 * which XML forbids.
 */
describe("app/icon.svg", () => {
  const svg = readFileSync(join(__dirname, "icon.svg"), "utf8");

  it("has no double hyphen inside a comment", () => {
    for (const [, body] of svg.matchAll(/<!--([\s\S]*?)-->/g)) {
      expect(body).not.toContain("--");
    }
  });

  it("is a single svg root with a viewBox", () => {
    expect(svg).toMatch(/<svg\b[^>]*\bviewBox=/);
    expect(svg.trimEnd().endsWith("</svg>")).toBe(true);
  });
});
