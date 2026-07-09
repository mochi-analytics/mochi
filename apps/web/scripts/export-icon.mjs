/**
 * Rasterizes app/icon.svg to PNG.
 *
 * The favicon resolves its colors through CSS custom properties and a
 * prefers-color-scheme query, neither of which the offline SVG rasterizers
 * understand. So we read the two palettes straight out of the file and inline
 * them, producing one flat SVG per theme before handing it to Inkscape.
 *
 * Usage: node scripts/export-icon.mjs [outDir] [size]
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const INKSCAPE = "C:/Program Files/Inkscape/bin/inkscape.exe";
const SRC = resolve(import.meta.dirname, "../src/app/icon.svg");
const outDir = resolve(process.argv[2] ?? ".");
const size = Number(process.argv[3] ?? 512);

const svg = readFileSync(SRC, "utf8");

/** Pull `--name: value;` pairs out of a CSS block. */
function vars(block) {
  return Object.fromEntries(
    [...block.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]),
  );
}

const rootBlock = svg.match(/:root\s*\{([^}]*)\}/)[1];
const darkBlock = svg.match(/prefers-color-scheme:\s*dark\)\s*\{\s*:root\s*\{([^}]*)\}/)[1];

const light = vars(rootBlock);
const dark = { ...light, ...vars(darkBlock) };

/** Strip the <style> block and substitute every var() with its literal value. */
function flatten(palette) {
  return svg
    .replace(/<style>[\s\S]*?<\/style>/, "")
    .replace(/var\(--([\w-]+)\)/g, (_, name) => {
      const value = palette[name];
      if (!value) throw new Error(`no value for --${name}`);
      return value;
    });
}

const tmp = mkdtempSync(join(tmpdir(), "mochi-icon-"));
try {
  for (const [theme, palette] of [["", light], ["-dark", dark]]) {
    const flat = join(tmp, `icon${theme}.svg`);
    const out = join(outDir, `icon${theme}.png`);
    writeFileSync(flat, flatten(palette));
    execFileSync(INKSCAPE, [
      flat,
      "--export-type=png",
      `--export-filename=${out}`,
      `--export-width=${size}`,
      `--export-height=${size}`,
      "--export-background-opacity=0",
    ]);
    console.log(`wrote ${out} (${size}x${size})`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
