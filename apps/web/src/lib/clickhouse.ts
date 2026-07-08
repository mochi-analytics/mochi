import { createClient } from "@clickhouse/client";

const globalForCh = globalThis as unknown as {
  chClient?: ReturnType<typeof createClient>;
};

export const clickhouse =
  globalForCh.chClient ??
  createClient({
    url: process.env.CLICKHOUSE_URL ?? "http://localhost:8123",
    username: process.env.CLICKHOUSE_USER ?? "mochi",
    password: process.env.CLICKHOUSE_PASSWORD ?? "",
    database: process.env.CLICKHOUSE_DB ?? "mochi",
    clickhouse_settings: {
      // Ingest writes are fire-and-forget; let ClickHouse buffer small inserts.
      async_insert: 1,
      wait_for_async_insert: 0,
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForCh.chClient = clickhouse;
}
