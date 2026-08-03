import { TeacherSimulationPanel } from "@/components/teacher/teacher-simulation-panel";

type TeacherSimulationPageProps = {
  searchParams?: Promise<{
    classId?: string | string[];
  }>;
};

export default async function TeacherSimulationPage(props: TeacherSimulationPageProps) {
  const searchParams = await props.searchParams;
  const initialClassId = Array.isArray(searchParams?.classId)
    ? searchParams?.classId[0]
    : searchParams?.classId;

  return <TeacherSimulationPanel initialClassId={initialClassId} />;
}
