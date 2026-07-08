import { redirect } from "next/navigation";
import { AdminTeams } from "@/components/admin/admin-teams";
import { AdminUsers } from "@/components/admin/admin-users";
import { listTeamsWithMembersAndBots, listUsersWithCounts } from "@/lib/admin";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { bots } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/bots");

  const [userList, teamList, allBots] = await Promise.all([
    listUsersWithCounts(),
    listTeamsWithMembersAndBots(),
    db
      .select({ id: bots.id, name: bots.name })
      .from(bots)
      .orderBy(bots.name),
  ]);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Manage users, roles, and teams. Teams share their bots with every
          member.
        </p>
      </div>

      <AdminUsers users={userList} currentUserId={user.id} />

      <AdminTeams
        teams={teamList}
        allUsers={userList.map((u) => ({
          id: u.id,
          username: u.username,
          role: u.role,
        }))}
        allBots={allBots}
      />
    </div>
  );
}
