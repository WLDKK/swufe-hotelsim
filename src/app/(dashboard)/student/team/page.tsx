import { StudentTeamPanel } from "@/components/student/student-team-panel";
import { StudentWorkspaceEmptyState } from "@/components/student/student-workspace-empty-state";
import { requireRoleSession } from "@/lib/auth/guards";
import { getStudentDecisionWorkspace } from "@/lib/dal/teams";

export default async function StudentTeamPage() {
  const session = await requireRoleSession(["STUDENT"]);
  const workspace = await getStudentDecisionWorkspace(session.user.id);

  if (!workspace) {
    return <StudentWorkspaceEmptyState section="team" />;
  }

  return (
    <StudentTeamPanel
      workspace={{
        team: workspace.team,
        courseClass: workspace.courseClass,
      }}
    />
  );
}
