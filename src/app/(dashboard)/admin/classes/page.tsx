import { AdminClassesPanel } from "@/components/admin/admin-classes-panel";

type AdminClassesPageProps = {
  searchParams?: Promise<{
    semesterId?: string | string[];
  }>;
};

export default async function AdminClassesPage(props: AdminClassesPageProps) {
  const searchParams = await props.searchParams;
  const initialSemesterId = Array.isArray(searchParams?.semesterId)
    ? searchParams?.semesterId[0]
    : searchParams?.semesterId;

  return <AdminClassesPanel initialSemesterId={initialSemesterId} />;
}
