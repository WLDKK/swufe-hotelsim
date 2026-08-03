import { StudentDecisionWorkspace } from "@/components/decisions/student-decision-workspace";
import { StudentWorkspaceEmptyState } from "@/components/student/student-workspace-empty-state";
import { requireRoleSession } from "@/lib/auth/guards";
import { getStudentDecisionWorkspace } from "@/lib/dal/teams";

function serializeDateValue(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : value;
}

export default async function StudentDecisionsPage() {
  const session = await requireRoleSession(["STUDENT"]);
  const workspace = await getStudentDecisionWorkspace(session.user.id);

  if (!workspace) {
    return <StudentWorkspaceEmptyState section="decisions" />;
  }

  return (
    <StudentDecisionWorkspace
      workspace={{
        team: workspace.team,
        courseClass: workspace.courseClass,
        round: workspace.round
          ? {
              ...workspace.round,
              // The cached DAL can return either Prisma Date objects or ISO
              // strings, so normalize here before handing the value to the
              // client decision workspace.
              deadline: serializeDateValue(workspace.round.deadline),
              processedAt: serializeDateValue(workspace.round.processedAt),
            }
          : null,
      }}
    />
  );
}
