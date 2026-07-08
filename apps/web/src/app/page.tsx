import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function Home() {
  const anyUser = await db.select({ id: users.id }).from(users).limit(1);
  if (anyUser.length === 0) redirect("/setup");

  const user = await getCurrentUser();
  redirect(user ? "/bots" : "/login");
}
