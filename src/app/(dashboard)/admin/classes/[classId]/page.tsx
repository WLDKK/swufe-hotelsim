import { TeacherClassDetailPanel } from "@/components/teacher/teacher-class-detail-panel";

type AdminClassDetailPageProps = {
  params: Promise<{
    classId: string;
  }>;
};

export default async function AdminClassDetailPage(props: AdminClassDetailPageProps) {
  const params = await props.params;
  return <TeacherClassDetailPanel classId={params.classId} viewer="admin" />;
}
