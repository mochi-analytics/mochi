# Self-hosting Mochi

Mochi runs as one app container plus Postgres (accounts/config) and
ClickHouse (events). A small VPS (2 GB RAM) handles it comfortably;
ClickHouse idles around 0.5–1 GB.

## Docker Compose (recommended)

```sh
git clone https://github.com/mochi-analytics/mochi
cd mochi
POSTGRES_PASSWORD=$(openssl rand -hex 16) \
CLICKHOUSE_PASSWORD=$(openssl rand -hex 16) \
docker compose -f docker/docker-compose.yml up -d --build
```

Persist the two passwords (e.g. in a `.env` file next to the compose file —
`POSTGRES_PASSWORD=…` / `CLICKHOUSE_PASSWORD=…`); the databases keep their
data in named volumes.

Open `http://your-host:3000` — the first visit walks you through creating
the admin account. Put a TLS-terminating reverse proxy (Caddy, nginx,
Traefik) in front for production.

Migrations run automatically at startup (`MIGRATE_ON_START=1`), and a daily
job enforces each bot's retention setting (`RETENTION_CLEANUP=1`). Set either
to `0` to manage these yourself.

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `CLICKHOUSE_URL` / `CLICKHOUSE_USER` / `CLICKHOUSE_PASSWORD` / `CLICKHOUSE_DB` | ClickHouse connection |
| `MIGRATE_ON_START` | `1` = apply migrations at boot |
| `RETENTION_CLEANUP` | `1` = daily retention cleanup |

## Upgrading

```sh
git pull
docker compose -f docker/docker-compose.yml up -d --build
```

Migrations apply automatically on boot.
