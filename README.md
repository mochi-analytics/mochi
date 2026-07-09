# Mochi

Self-hosted analytics for Discord bots: command usage, server growth, and bot
health in one dashboard.

Full documentation: **[docs.mochis.dev](https://docs.mochis.dev)**

## Features

- Privacy-friendly analytics with salted user-id hashing
- Command usage, success rate, latency, and unique-user metrics
- Guild growth and churn tracking
- Custom events with metadata
- Realtime activity feed
- Public read-only share links
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

## Instrumentation

- [discord.js SDK](https://docs.mochis.dev/sdks/discordjs)
- [discord.py SDK](https://docs.mochis.dev/sdks/discordpy)
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

## License

Mochi is licensed under `AGPL-3.0-or-later`. See [LICENSE](./LICENSE).

The Mochi name, logos, and project branding are not licensed under this
software license. They may not be used to imply endorsement or to operate a
confusingly similar hosted service.
