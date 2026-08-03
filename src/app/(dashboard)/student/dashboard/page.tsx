import { StudentDashboardPanel } from "@/components/student/student-dashboard-panel";
import { StudentWorkspaceEmptyState } from "@/components/student/student-workspace-empty-state";
import { requireRoleSession } from "@/lib/auth/guards";
import { getStudentDecisionWorkspace } from "@/lib/dal/teams";

function serializeDateValue(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : value;
}

export default async function StudentDashboardPage() {
  const session = await requireRoleSession(["STUDENT"]);
  const workspace = await getStudentDecisionWorkspace(session.user.id);

  if (!workspace) {
    return <StudentWorkspaceEmptyState section="dashboard" />;
  }

  return (
    <StudentDashboardPanel
      workspace={{
        team: workspace.team,
        courseClass: workspace.courseClass,
        round: workspace.round
          ? {
              ...workspace.round,
              // The cached DAL can return either Prisma Date objects or ISO
              // strings, so normalize here before handing the value to the
              // client dashboard shell.
              deadline: serializeDateValue(workspace.round.deadline),
              processedAt: serializeDateValue(workspace.round.processedAt),
            }
          : null,
      }}
    />
  );
}
