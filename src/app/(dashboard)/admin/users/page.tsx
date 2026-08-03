import { AdminUsersPanel } from "@/components/admin/admin-users-panel";
import { requireRoleSession } from "@/lib/auth/guards";

export default async function AdminUsersPage() {
  const session = await requireRoleSession(["ADMIN"]);

  return <AdminUsersPanel currentAdminId={session.user.id} />;
}
