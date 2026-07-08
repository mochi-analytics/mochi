# Ingest API

The wire contract for sending analytics from a bot to Mochi. The official
SDKs wrap this; any language can implement it directly.

**Authentication:** every request carries an API key (created in the bot's
settings page) as `Authorization: Bearer mochi_sk_…`.

## POST /api/v1/ingest

Send a batch of events.

```json
{
  "events": [
    {
      "type": "command",
      "name": "play",
      "guildId": "935512380767846400",
      "userId": "102992563902441472",
      "channelType": "guild_text",
      "shardId": 0,
      "success": true,
      "durationMs": 143,
      "meta": { "source": "slash" },
      "ts": "2026-07-07T12:00:00.000Z"
    }
  ]
}
```

| Field | Type | Notes |
|---|---|---|
| `type` | `command` \| `guild_join` \| `guild_leave` \| `error` \| `custom` | required |
| `name` | string ≤128 | required for `command`/`custom`/`error` |
| `guildId` | snowflake string | omit for DMs |
| `userId` | snowflake string | hashed server-side with a per-bot salt; the raw id is never stored |
| `channelType` | `guild_text` \| `guild_voice` \| `thread` \| `dm` \| `group_dm` \| `other` | |
| `shardId` | int | |
| `success` | boolean | defaults to `true` |
| `durationMs` | int | command execution time |
| `meta` | object ≤2 KB JSON | custom dimensions |
| `ts` | ISO 8601 | defaults to arrival time |

Limits: **100 events/request**, **256 KB body**, events older than **48 h**
or more than 5 minutes in the future are rejected per-event.

**Response `202`:**

```json
{ "accepted": 4, "rejected": 1, "rejections": [{ "index": 4, "reason": "event older than 48h" }] }
```

Errors: `400` validation (with zod issues), `401` bad/revoked key,
`413` oversized body, `429` rate limited (respect `Retry-After`).

Rate limit: 120 requests/min per key with burst to 240 — batch client-side;
a full batch carries 100 events, so the effective ceiling is ~12k events/min.

## POST /api/v1/snapshot

Send a guild-count/health sample. The SDK does this on ready and hourly;
snapshots power the "servers over time" chart, which stays accurate even if
join/leave events are missed while the bot is offline.

```json
{ "guildCount": 1204, "shardId": 0, "totalShards": 2, "approximateMemberSum": 803210, "wsPingMs": 38 }
```

For sharded bots, send one snapshot per shard with that shard's local
`guildCount`; Mochi sums the latest snapshot per shard.
