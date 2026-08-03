import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { requireRoleSession } from "@/lib/auth/guards";

const adminNavItems = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/semesters", label: "Semesters" },
  { href: "/admin/classes", label: "Classes" },
];

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireRoleSession(["ADMIN"]);
  const userEmail = session.user.email ?? "admin@hotelsim.example";
  const userName = session.user.name ?? userEmail;

  return (
    <WorkspaceShell
      role="admin"
      userName={userName}
      userEmail={userEmail}
      navItems={adminNavItems}
    >
      {children}
    </WorkspaceShell>
  );
}
