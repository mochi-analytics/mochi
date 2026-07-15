import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/settings/profile-form";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Your account identity and access settings.
        </p>
      </div>

      <ProfileForm
        username={user.username}
        role={user.role}
        email={user.email}
        hasPassword={user.passwordHash !== null}
      />
    </div>
  );
}
