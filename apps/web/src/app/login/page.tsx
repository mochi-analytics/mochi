import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth-card";
import { DiscordAuthForm } from "@/components/discord-auth-form";
import { LoginForm } from "@/components/login-form";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { isCloud } from "@/lib/deployment";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const anyUser = await db.select({ id: users.id }).from(users).limit(1);
  if (anyUser.length === 0) redirect("/setup");

  const user = await getCurrentUser();
  if (user) redirect("/bots");
  const cloud = isCloud();
  const { error } = await searchParams;

  return (
    <AuthCard title="Sign in to Mochi" subtitle="Analytics for your Discord bots.">
      {error && (
        <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}
      {cloud && (
        <>
          <DiscordAuthForm siteKey={process.env.TURNSTILE_SITE_KEY} />
          <div className="my-5 flex items-center gap-3 text-xs text-zinc-400">
            <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
            Existing password account
            <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          </div>
        </>
      )}
      <LoginForm />
      {cloud && (
        <p className="mt-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
          New here?{" "}
          <Link href="/signup" className="font-medium underline hover:no-underline">
            Create an account
          </Link>
        </p>
      )}
    </AuthCard>
  );
}
