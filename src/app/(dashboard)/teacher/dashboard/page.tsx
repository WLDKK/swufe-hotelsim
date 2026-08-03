import { TeacherDashboardPanel } from "@/components/teacher/teacher-dashboard-panel";

type TeacherDashboardPageProps = {
  searchParams?: Promise<{
    classId?: string | string[];
  }>;
};

export default async function TeacherDashboardPage(props: TeacherDashboardPageProps) {
  const searchParams = await props.searchParams;
  const initialClassId = Array.isArray(searchParams?.classId)
    ? searchParams?.classId[0]
    : searchParams?.classId;

  return <TeacherDashboardPanel initialClassId={initialClassId} />;
}
