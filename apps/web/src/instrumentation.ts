export async function register() {
  // The static condition lets Next exclude the node-only module (and its
  // ClickHouse/Postgres deps) from the edge-runtime bundle.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
