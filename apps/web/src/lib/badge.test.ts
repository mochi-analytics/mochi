import { describe, expect, it } from "vitest";
import { escapeXml, renderBadge } from "@/lib/badge";

describe("escapeXml", () => {
  it("escapes the five XML special characters", () => {
    expect(escapeXml(`<&>"'`)).toBe("&lt;&amp;&gt;&quot;&apos;");
  });
});

describe("renderBadge", () => {
  it("renders label and value into a valid standalone svg", () => {
    const svg = renderBadge("servers", "12K");
    expect(svg).toContain("<svg");
    expect(svg).toContain(">servers</text>");
    expect(svg).toContain(">12K</text>");
    expect(svg).not.toMatch(/<image|xlink:href/); // no external fetches
  });

  it("escapes markup in inputs", () => {
    const svg = renderBadge('<script>"x"</script>', "1");
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
  });

  it("grows with text length", () => {
    const short = /width="(\d+)"/.exec(renderBadge("a", "1"))![1];
    const long = /width="(\d+)"/.exec(renderBadge("a much longer label", "1"))![1];
    expect(Number(long)).toBeGreaterThan(Number(short));
  });
});
