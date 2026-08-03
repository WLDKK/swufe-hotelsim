import { TeacherClassesPanel } from "@/components/teacher/teacher-classes-panel";

type TeacherClassesPageProps = {
  searchParams?: Promise<{
    semesterId?: string | string[];
  }>;
};

export default async function TeacherClassesPage(props: TeacherClassesPageProps) {
  const searchParams = await props.searchParams;
  const initialSemesterId = Array.isArray(searchParams?.semesterId)
    ? searchParams?.semesterId[0]
    : searchParams?.semesterId;

  return <TeacherClassesPanel initialSemesterId={initialSemesterId} />;
}
