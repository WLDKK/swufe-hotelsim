import { StudentJoinClassPanel } from "@/components/student/student-join-class-panel";
import { requireRoleSession } from "@/lib/auth/guards";
import { getStudentDecisionWorkspace } from "@/lib/dal/teams";

export default async function StudentJoinPage() {
  const session = await requireRoleSession(["STUDENT"]);
  const workspace = await getStudentDecisionWorkspace(session.user.id);

  return (
    <StudentJoinClassPanel
      currentWorkspace={
        workspace
          ? {
              team: {
                id: workspace.team.id,
                name: workspace.team.name,
                hotelName: workspace.team.hotelName,
              },
              courseClass: workspace.courseClass,
            }
          : null
      }
    />
  );
}
