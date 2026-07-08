import { redirect } from "next/navigation";
import { UserSettingsForm } from "@/components/user-settings-form";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function UserSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">User settings</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Manage your account preferences — username, password, and theme.
        </p>
      </div>

      <UserSettingsForm username={user.username} />
    </div>
  );
}
