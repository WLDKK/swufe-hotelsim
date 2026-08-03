import { TeacherClassDetailPanel } from "@/components/teacher/teacher-class-detail-panel";

type TeacherClassDetailPageProps = {
  params: Promise<{
    classId: string;
  }>;
};

export default async function TeacherClassDetailPage(props: TeacherClassDetailPageProps) {
  const params = await props.params;
  return <TeacherClassDetailPanel classId={params.classId} />;
}
