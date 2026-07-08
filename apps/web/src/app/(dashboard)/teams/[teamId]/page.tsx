import { notFound, redirect } from "next/navigation";
import { TeamDetail } from "@/components/teams/team-detail";
import { getCurrentUser } from "@/lib/auth/session";
import { getTeamForUser } from "@/lib/teams";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ teamId: string }> };

export default async function TeamPage({ params }: Params) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { teamId } = await params;
  const team = await getTeamForUser(teamId, user);
  if (!team) notFound();

  return <TeamDetail team={team} currentUserId={user.id} />;
}
