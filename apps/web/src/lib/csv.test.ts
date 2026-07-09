import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/csv";

describe("toCsv", () => {
  it("joins headers and rows with CRLF", () => {
    expect(toCsv(["a", "b"], [["x", 1]])).toBe("a,b\r\nx,1\r\n");
  });

  it("quotes cells containing commas, quotes, or newlines", () => {
    expect(toCsv(["v"], [['say "hi", ok']])).toBe('v\r\n"say ""hi"", ok"\r\n');
    expect(toCsv(["v"], [["line1\nline2"]])).toBe('v\r\n"line1\nline2"\r\n');
  });

  it("renders null/undefined as empty cells", () => {
    expect(toCsv(["a", "b"], [[null, undefined]])).toBe("a,b\r\n,\r\n");
  });

  it("neutralizes spreadsheet formula injection", () => {
    expect(toCsv(["v"], [["=SUM(A1)"]])).toBe("v\r\n'=SUM(A1)\r\n");
    expect(toCsv(["v"], [["@cmd"]])).toBe("v\r\n'@cmd\r\n");
    // Numbers are not formulas — left untouched.
    expect(toCsv(["v"], [[-5]])).toBe("v\r\n-5\r\n");
  });
});
