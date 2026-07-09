/**
 * Shields-style flat SVG badge, self-contained (no external fetches) so it
 * can be hotlinked from READMEs and bot-list pages.
 */

const HEIGHT = 20;
const PAD = 6;
/** Approximate Verdana 11px advance; close enough for badge sizing. */
const CHAR_WIDTH = 6.3;

export const BADGE_COLOR = "#e8590c"; // mochi brand-ish; overridable per call

function textWidth(text: string): number {
  return Math.ceil(text.length * CHAR_WIDTH);
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function renderBadge(
  label: string,
  value: string,
  color = BADGE_COLOR,
): string {
  const labelWidth = textWidth(label) + PAD * 2;
  const valueWidth = textWidth(value) + PAD * 2;
  const width = labelWidth + valueWidth;
  const safeLabel = escapeXml(label);
  const safeValue = escapeXml(value);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${HEIGHT}" role="img" aria-label="${safeLabel}: ${safeValue}">
  <title>${safeLabel}: ${safeValue}</title>
  <clipPath id="r"><rect width="${width}" height="${HEIGHT}" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="${HEIGHT}" fill="#555"/>
    <rect x="${labelWidth}" width="${valueWidth}" height="${HEIGHT}" fill="${escapeXml(color)}"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${labelWidth / 2}" y="14" fill="#010101" fill-opacity=".3">${safeLabel}</text>
    <text x="${labelWidth / 2}" y="13">${safeLabel}</text>
    <text x="${labelWidth + valueWidth / 2}" y="14" fill="#010101" fill-opacity=".3">${safeValue}</text>
    <text x="${labelWidth + valueWidth / 2}" y="13">${safeValue}</text>
  </g>
</svg>`;
}
