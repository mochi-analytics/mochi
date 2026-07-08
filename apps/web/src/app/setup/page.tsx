import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth-card";
import { SetupForm } from "@/components/setup-form";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const anyUser = await db.select({ id: users.id }).from(users).limit(1);
  if (anyUser.length > 0) redirect("/login");

  return (
    <AuthCard
      title="Welcome to Mochi"
      subtitle="Create the admin account for this instance to get started."
    >
      <SetupForm />
    </AuthCard>
  );
}
