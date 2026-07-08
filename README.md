# Mochi

Self-hosted analytics for Discord bots: command usage, server growth, and bot
health in one dashboard.

## Features

- Privacy-friendly analytics with salted user-id hashing
- Command usage, success rate, latency, and unique-user metrics
- Guild growth and churn tracking
- Custom events with metadata
- Realtime activity feed
- Public read-only share links
- Per-bot API keys, retention settings, and salt rotation

## Self-Hosting

See [docs/self-hosting.md](./docs/self-hosting.md).

```sh
POSTGRES_PASSWORD=... CLICKHOUSE_PASSWORD=... \
docker compose -f docker/docker-compose.yml up -d
```

Docker image:

```text
ghcr.io/mochi-analytics/mochi
```

## Instrumentation

Discord.js SDK setup: [docs/sdk-discordjs.md](./docs/sdk-discordjs.md)

Raw ingest API: [docs/ingest-api.md](./docs/ingest-api.md)

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
- `docs/` - self-hosting, SDK, and ingest API docs

## License

Mochi is licensed under `AGPL-3.0-or-later`. See [LICENSE](./LICENSE).

The Mochi name, logos, and project branding are not licensed under this
software license. They may not be used to imply endorsement or to operate a
confusingly similar hosted service.
