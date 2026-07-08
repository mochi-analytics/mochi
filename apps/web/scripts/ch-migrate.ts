import "dotenv/config";
import { join } from "node:path";
import { createClient } from "@clickhouse/client";
import { runClickhouseMigrations } from "../src/lib/ch-migrations";

async function main() {
  const client = createClient({
    url: process.env.CLICKHOUSE_URL ?? "http://localhost:8123",
    username: process.env.CLICKHOUSE_USER ?? "mochi",
    password: process.env.CLICKHOUSE_PASSWORD ?? "",
    database: process.env.CLICKHOUSE_DB ?? "mochi",
  });

  const applied = await runClickhouseMigrations(
    client,
    join(import.meta.dirname, "..", "clickhouse", "migrations"),
  );
  for (const file of applied) console.log(`applied ${file}`);

  await client.close();
  console.log("clickhouse migrations up to date");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
