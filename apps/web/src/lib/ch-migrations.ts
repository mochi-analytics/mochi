import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { createClient } from "@clickhouse/client";

/**
 * Ordered-SQL-file migration runner for ClickHouse. Applied file names are
 * tracked in a _migrations table inside ClickHouse itself. Used by both the
 * dev script and MIGRATE_ON_START.
 */
export async function runClickhouseMigrations(
  client: ReturnType<typeof createClient>,
  dir: string = join(process.cwd(), "clickhouse", "migrations"),
): Promise<string[]> {
  await client.command({
    query: `CREATE TABLE IF NOT EXISTS _migrations (
      name String,
      applied_at DateTime DEFAULT now()
    ) ENGINE = MergeTree ORDER BY name`,
  });

  const appliedResult = await client.query({
    query: "SELECT name FROM _migrations",
    format: "JSONEachRow",
  });
  const applied = new Set(
    (await appliedResult.json<{ name: string }>()).map((r) => r.name),
  );

  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const newlyApplied: string[] = [];

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(dir, file), "utf8");
    const statements = sql
      .split(/;\s*(?:\r?\n|$)/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const statement of statements) {
      await client.command({ query: statement });
    }
    await client.insert({
      table: "_migrations",
      values: [{ name: file }],
      format: "JSONEachRow",
    });
    newlyApplied.push(file);
  }

  return newlyApplied;
}
