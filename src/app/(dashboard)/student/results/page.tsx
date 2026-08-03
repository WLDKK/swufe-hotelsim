import { StudentResultsPanel } from "@/components/student/student-results-panel";
import { StudentWorkspaceEmptyState } from "@/components/student/student-workspace-empty-state";
import { requireRoleSession } from "@/lib/auth/guards";
import { getStudentDecisionWorkspace } from "@/lib/dal/teams";

export default async function StudentResultsPage() {
  const session = await requireRoleSession(["STUDENT"]);
  const workspace = await getStudentDecisionWorkspace(session.user.id);

  if (!workspace) {
    return <StudentWorkspaceEmptyState section="results" />;
  }

  return (
    <StudentResultsPanel
      workspace={{
        team: workspace.team,
        courseClass: workspace.courseClass,
      }}
    />
  );
}
