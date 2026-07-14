<p align="center">
  <img src="icon.png" alt="" width="96" height="96">
</p>

# Mochi

Self-hosted analytics for Discord bots: command usage, server growth, and bot
health in one dashboard.

Full documentation: **[docs.mochis.dev](https://docs.mochis.dev)**

## Features

- Privacy-friendly analytics with salted user-id hashing
- Command usage, success rate, latency, and unique-user metrics
- Guild growth and churn tracking, with previous-period comparison
- Custom events with metadata and a per-event meta explorer
- Error tracking: error events, failing commands, affected users
- Health dashboard: per-shard status, gateway ping, uptime
- Discord webhook alerts (offline, error spikes, server drops) and a weekly digest
- Realtime activity feed
- Public read-only share links, README badges, and embeddable widgets
- CSV/JSON exports and a read-only stats API
- Per-bot API keys, retention settings, and salt rotation

## Self-Hosting

See the [self-hosting guide](https://docs.mochis.dev/self-hosting).

```sh
POSTGRES_PASSWORD=... CLICKHOUSE_PASSWORD=... \
docker compose -f docker/docker-compose.yml up -d
```

Docker image:

```text
ghcr.io/mochi-analytics/mochi
```

## Cloud Mode

Set `MOCHI_CLOUD=1` to run a shared, multi-tenant instance:

- `/signup` opens for self-service registration (new accounts get the
  `user` role; the operator's admin account still comes from first-run
  `/setup`)
- each non-admin account is limited to 1 owned bot and 1 owned team
- data retention is capped at 183 days (half a year) for non-admin accounts
- login and signup are rate-limited per IP

Self-hosted instances are unaffected: signups stay closed and no quotas,
caps, or rate limits apply.

The cloud branch has a dedicated Coolify Compose stack that builds the current
checkout, enables cloud mode, and publishes the app on port 3000 by default.
Coolify generates and persists separate 64-character passwords for Postgres
and ClickHouse through its `SERVICE_PASSWORD_64_*` magic variables.

To render or run this stack outside Coolify, supply those two variables
yourself:

```sh
SERVICE_PASSWORD_64_POSTGRES=... SERVICE_PASSWORD_64_CLICKHOUSE=... \
docker compose -f docker/docker-compose.cloud.yml up -d --build
```

Set `MOCHI_PORT` to publish a different host port.

## Instrumentation

- [discord.js SDK](https://docs.mochis.dev/sdks/discordjs)
- [discord.py SDK](https://docs.mochis.dev/sdks/discordpy)
- [discordgo SDK](https://docs.mochis.dev/sdks/go)
- [Raw ingest API](https://docs.mochis.dev/ingest-api) - for any other language

All SDKs: [docs.mochis.dev/sdks](https://docs.mochis.dev/sdks)

## Development

Requirements: Node 20+, pnpm, Docker.

```sh
pnpm install
pnpm db:up
pnpm --filter @mochi/web db:migrate
pnpm --filter @mochi/web ch:migrate
pnpm dev
```

Optional demo data:

```sh
pnpm --filter @mochi/web seed
```

## Layout

- `apps/web` - Next.js dashboard, management API, ingest API
- `docker/` - Dockerfile and Docker Compose files

## Help wanted: a better logo

The mascot above was drawn by a developer, not a designer, and it shows. It is
a placeholder, and we would love for someone to replace it.

If you would like to take a pass at it, open an issue or a PR. Roughly what
we're after:

- Reads clearly at 16x16 (favicon) as well as at full size
- Works on both light and dark backgrounds
- An SVG source, ideally one that themes through CSS custom properties the way
  [`apps/web/src/app/icon.svg`](apps/web/src/app/icon.svg) does
- Keeps the general spirit: a soft, round, friendly rice cake

The current icon lives at `apps/web/src/app/icon.svg`. The PNGs at the repo root
are rasterized from it by `apps/web/scripts/export-icon.mjs`.

Contributions are credited, and by opening a PR you agree to license the artwork
to the project under the same terms as the rest of the branding.

## License

Mochi is licensed under `AGPL-3.0-or-later`. See [LICENSE](./LICENSE).

The Mochi name, logos, and project branding are not licensed under this
software license. They may not be used to imply endorsement or to operate a
confusingly similar hosted service.
