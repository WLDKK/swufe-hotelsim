import { AdminDashboardPanel } from "@/components/admin/admin-dashboard-panel";

type AdminDashboardPageProps = {
  searchParams?: Promise<{
    classId?: string | string[];
  }>;
};

export default async function AdminDashboardPage(props: AdminDashboardPageProps) {
  const searchParams = await props.searchParams;
  const initialClassId = Array.isArray(searchParams?.classId)
    ? searchParams?.classId[0]
    : searchParams?.classId;

  return <AdminDashboardPanel initialClassId={initialClassId} />;
}
