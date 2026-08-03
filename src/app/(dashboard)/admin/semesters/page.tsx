import { AdminSemestersPanel } from "@/components/admin/admin-semesters-panel";
import { requireRoleSession } from "@/lib/auth/guards";

export default async function AdminSemestersPage() {
  const session = await requireRoleSession(["ADMIN"]);

  return (
    <AdminSemestersPanel
      currentAdmin={{
        id: session.user.id,
        name: session.user.name ?? null,
        email: session.user.email ?? "",
        role: "ADMIN",
      }}
    />
  );
}
