import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { NextConfig } from "next";

/** Product version comes from the release-managed root package.json. */
function appVersion(): string {
  // Prefer the release-managed root "mochi" version; fall back to the web
  // package version (e.g. in a standalone build without the root manifest).
  try {
    const root = JSON.parse(
      readFileSync(join(process.cwd(), "../../package.json"), "utf8"),
    );
    if (root.name === "mochi" && typeof root.version === "string") {
      return root.version;
    }
  } catch {
    // fall through
  }
  try {
    const web = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf8"),
    );
    if (typeof web.version === "string") return web.version;
  } catch {
    // fall through
  }
  return "unknown";
}

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion(),
  },
};

export default nextConfig;
