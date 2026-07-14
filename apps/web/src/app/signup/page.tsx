import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth-card";
import { SignupForm } from "@/components/signup-form";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { isCloud } from "@/lib/deployment";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  if (!isCloud()) redirect("/login");

  const anyUser = await db.select({ id: users.id }).from(users).limit(1);
  if (anyUser.length === 0) redirect("/setup");

  const user = await getCurrentUser();
  if (user) redirect("/bots");

  return (
    <AuthCard
      title="Create your Mochi account"
      subtitle="Analytics for your Discord bots."
    >
      <SignupForm />
      <p className="mt-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
        Already have an account?{" "}
        <Link href="/login" className="font-medium underline hover:no-underline">
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}
