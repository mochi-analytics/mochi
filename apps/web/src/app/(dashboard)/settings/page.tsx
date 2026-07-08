import { redirect } from "next/navigation";
import { PreferencesForm } from "@/components/settings/preferences-form";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function PreferencesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Preferences</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Theme, timezone, and the default date range for your dashboards.
        </p>
      </div>

      <PreferencesForm
        version={process.env.NEXT_PUBLIC_APP_VERSION ?? "unknown"}
        timezone={user.timezone}
        defaultRange={user.defaultRange}
      />
    </div>
  );
}
