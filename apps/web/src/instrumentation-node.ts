import { join } from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { runAlertSweep } from "@/lib/alerts";
import { clickhouse } from "@/lib/clickhouse";
import { runClickhouseMigrations } from "@/lib/ch-migrations";
import { db } from "@/lib/db";
import { runRetentionCleanup } from "@/lib/retention";

/**
 * Server-startup tasks (Node runtime only; see instrumentation.ts).
 * - MIGRATE_ON_START=1: apply Postgres + ClickHouse migrations (the Docker
 *   self-host path; dev uses the pnpm scripts instead).
 * - RETENTION_CLEANUP=1: run the retention cleanup shortly after boot and
 *   then daily.
 * - ALERTS=1: evaluate Discord-webhook alert rules (and weekly digests)
 *   every minute.
 */
async function startup() {
  if (process.env.MIGRATE_ON_START === "1") {
    await migrate(db, { migrationsFolder: join(process.cwd(), "drizzle") });
    console.log("[mochi] postgres migrations applied");

    const applied = await runClickhouseMigrations(clickhouse);
    console.log(
      `[mochi] clickhouse migrations applied${applied.length ? `: ${applied.join(", ")}` : " (none new)"}`,
    );
  }

  if (process.env.RETENTION_CLEANUP === "1") {
    const run = () =>
      runRetentionCleanup()
        .then(() => console.log("[mochi] retention cleanup complete"))
        .catch((err) => console.error("[mochi] retention cleanup failed", err));
    setTimeout(run, 60_000).unref?.();
    setInterval(run, 24 * 60 * 60 * 1000).unref?.();
  }

  if (process.env.ALERTS === "1") {
    // runAlertSweep never throws, and overlap is impossible: sweeps are
    // chained, never started while one is in flight.
    let sweeping = false;
    const sweep = async () => {
      if (sweeping) return;
      sweeping = true;
      await runAlertSweep();
      sweeping = false;
    };
    setTimeout(sweep, 30_000).unref?.();
    setInterval(sweep, 60_000).unref?.();
  }
}

await startup();
