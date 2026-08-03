import { TeacherGradingPanel } from "@/components/teacher/teacher-grading-panel";

type TeacherGradingPageProps = {
  searchParams?: Promise<{
    classId?: string | string[];
  }>;
};

export default async function TeacherGradingPage(props: TeacherGradingPageProps) {
  const searchParams = await props.searchParams;
  const initialClassId = Array.isArray(searchParams?.classId)
    ? searchParams?.classId[0]
    : searchParams?.classId;

  return <TeacherGradingPanel initialClassId={initialClassId} />;
}
