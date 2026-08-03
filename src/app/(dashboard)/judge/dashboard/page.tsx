import { JudgeDashboardPanel } from "@/components/judge/judge-dashboard-panel";
import { requireRoleSession } from "@/lib/auth/guards";
import { getJudgeDashboardSnapshot } from "@/lib/dal/competitions";

export default async function JudgeDashboardPage() {
  const session = await requireRoleSession(["JUDGE"]);
  const snapshot = await getJudgeDashboardSnapshot(session.user.id);

  return <JudgeDashboardPanel snapshot={snapshot} />;
}
