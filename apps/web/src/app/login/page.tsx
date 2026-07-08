import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth-card";
import { LoginForm } from "@/components/login-form";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const anyUser = await db.select({ id: users.id }).from(users).limit(1);
  if (anyUser.length === 0) redirect("/setup");

  const user = await getCurrentUser();
  if (user) redirect("/bots");

  return (
    <AuthCard title="Sign in to Mochi" subtitle="Analytics for your Discord bots.">
      <LoginForm />
    </AuthCard>
  );
}
