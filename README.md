# Mochi

Self-hosted analytics for Discord bots — command usage, server growth, and
bot health in one dashboard. Think [Umami](https://umami.is), but for bots.

- **Privacy-first** — user ids are salted-hashed before storage; unique-user
  counts without identifying anyone. No message content, ever.
- **Drop-in SDK** — two lines with discord.js, or a documented HTTP API from
  any language.
- **Public share links** — a read-only stats page for your bot's community.
- **Your data** — one `docker compose up` on your own server: Next.js app +
  Postgres + ClickHouse.

## Features

- Overview: servers over time, joins vs leaves, command volume, unique
  users, error rate, p95 latency
- Command explorer with success rates and latency percentiles
- Most-active servers, recent joins/leaves
- Custom events with metadata (`premium_purchased`, `level_up`, …)
- Realtime live feed
- Per-bot API keys, data retention, salt rotation, share links

## Quick start (self-hosting)

See [docs/self-hosting.md](./docs/self-hosting.md). TL;DR:

```sh
POSTGRES_PASSWORD=… CLICKHOUSE_PASSWORD=… \
docker compose -f docker/docker-compose.yml up -d --build
```

Then instrument your bot — [docs/sdk-discordjs.md](./docs/sdk-discordjs.md):

```ts
import { MochiClient } from "@mochi-analytics/core";
import { attachMochi } from "@mochi-analytics/discordjs";

const mochi = new MochiClient({ url: "https://your-mochi", apiKey: "mochi_sk_…" });
attachMochi(client, mochi);
```

Other languages: [docs/ingest-api.md](./docs/ingest-api.md).

## Development

Requirements: Node 20+, pnpm, Docker.

```sh
pnpm install
pnpm db:up                            # Postgres + ClickHouse (docker)
pnpm --filter @mochi/web db:migrate   # Postgres migrations
pnpm --filter @mochi/web ch:migrate   # ClickHouse migrations
pnpm dev                              # http://localhost:3000
pnpm --filter @mochi/web seed         # optional: 30 days of demo data
```

## Releases

Release Please opens and updates a release PR from conventional commits merged
to `main`. Merging that PR creates the GitHub release and tag.

The publish workflow then builds and publishes the web Docker image to GitHub
Container Registry from the published release:

```text
ghcr.io/<owner>/<repo>
```

JavaScript SDK releases live in the separate `mochi-js` repository.

## Layout

- `apps/web` — Next.js dashboard, management API, ingest API
- `docker/` — dev databases + self-host compose/Dockerfile
- `docs/` — ingest API spec, self-hosting, SDK guides

See [PLAN.md](./PLAN.md) for the roadmap.

## License

Mochi is licensed under `AGPL-3.0-or-later`. See [LICENSE](./LICENSE).

The Mochi name, logos, and project branding are not licensed under either
software license. They may not be used to imply endorsement or to operate a
confusingly similar hosted service.
