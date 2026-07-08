import { redirect } from "next/navigation";
import { TeamsList } from "@/components/teams/teams-list";
import { getCurrentUser } from "@/lib/auth/session";
import { listTeamsForUser } from "@/lib/teams";

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const teams = await listTeamsForUser(user);
  const canCreate = user.role !== "viewer";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Teams</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Create a team and share its access code, or join one with a code.
        </p>
      </div>

      <TeamsList teams={teams} canCreate={canCreate} />
    </div>
  );
}
