import { JudgeScoringPanel } from "@/components/judge/judge-scoring-panel";
import { requireRoleSession } from "@/lib/auth/guards";

export default async function JudgeScoringPage() {
  const session = await requireRoleSession(["JUDGE"]);

  return <JudgeScoringPanel currentUserId={session.user.id} />;
}
