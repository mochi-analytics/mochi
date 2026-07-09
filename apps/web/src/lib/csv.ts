/** CSV serialization for exports: RFC 4180 quoting + formula-injection guard. */

type Cell = string | number | null | undefined;

function escapeCell(cell: Cell): string {
  if (cell === null || cell === undefined) return "";
  if (typeof cell === "number") return String(cell);
  // Spreadsheets execute cells starting with = + - @; neutralize with a
  // leading apostrophe so exported event names can't become formulas.
  const value = /^[=+\-@]/.test(cell) ? `'${cell}` : cell;
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(headers: string[], rows: Cell[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCell).join(","));
  return `${lines.join("\r\n")}\r\n`;
}
