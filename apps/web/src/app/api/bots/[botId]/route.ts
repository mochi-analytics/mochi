import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireBotAccess, requireBotWrite } from "@/lib/api";
import { db } from "@/lib/db";
import { bots } from "@/lib/db/schema";

type Params = { params: Promise<{ botId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { botId } = await params;
  const access = await requireBotAccess(botId);
  if ("response" in access) return access.response;

  return NextResponse.json({ bot: access.bot });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { botId } = await params;
  const access = await requireBotWrite(botId);
  if ("response" in access) return access.response;

  // Postgres rows cascade; ClickHouse events are removed by the retention
  // cleanup job (M5) rather than synchronously here.
  await db.delete(bots).where(eq(bots.id, access.bot.id));
  return NextResponse.json({ ok: true });
}
