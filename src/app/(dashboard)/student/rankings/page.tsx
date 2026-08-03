import { StudentRankingsPanel } from "@/components/student/student-rankings-panel";
import { StudentWorkspaceEmptyState } from "@/components/student/student-workspace-empty-state";
import { requireRoleSession } from "@/lib/auth/guards";
import { getStudentDecisionWorkspace } from "@/lib/dal/teams";

export default async function StudentRankingsPage() {
  const session = await requireRoleSession(["STUDENT"]);
  const workspace = await getStudentDecisionWorkspace(session.user.id);

  if (!workspace) {
    return <StudentWorkspaceEmptyState section="rankings" />;
  }

  return (
    <StudentRankingsPanel
      workspace={{
        team: workspace.team,
        courseClass: workspace.courseClass,
      }}
    />
  );
}
