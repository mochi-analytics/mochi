import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth-card";
import { DiscordAuthForm } from "@/components/discord-auth-form";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { isCloud } from "@/lib/deployment";

export const dynamic = "force-dynamic";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!isCloud()) redirect("/login");

  const anyUser = await db.select({ id: users.id }).from(users).limit(1);
  if (anyUser.length === 0) redirect("/setup");

  const user = await getCurrentUser();
  if (user) redirect("/bots");
  const { error } = await searchParams;

  return (
    <AuthCard
      title="Create your Mochi account"
      subtitle="Analytics for your Discord bots."
    >
      {error && (
        <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}
      <DiscordAuthForm siteKey={process.env.TURNSTILE_SITE_KEY} />
      <p className="mt-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
        Already have an account?{" "}
        <Link href="/login" className="font-medium underline hover:no-underline">
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}
