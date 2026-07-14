import { redirect } from "next/navigation";
import { TeamsList } from "@/components/teams/teams-list";
import { getCurrentUser } from "@/lib/auth/session";
import { teamQuotaFor } from "@/lib/deployment";
import { listTeamsForUser } from "@/lib/teams";

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const teams = await listTeamsForUser(user);
  const quota = teamQuotaFor(user.role);
  const ownedCount = teams.filter((t) => t.isOwner).length;
  const atQuota = quota !== null && ownedCount >= quota;
  const canCreate = user.role !== "viewer" && !atQuota;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Teams</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Create a team and share its access code, or join one with a code.
        </p>
      </div>

      <TeamsList teams={teams} canCreate={canCreate} />

      {user.role !== "viewer" && atQuota && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Your account includes {quota === 1 ? "1 team" : `${quota} teams`} (
          {ownedCount} of {quota} used). You can still join other teams with an
          access code.
        </p>
      )}
    </div>
  );
}
