import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { requireRoleSession } from "@/lib/auth/guards";

const studentNavItems = [
  { href: "/student/dashboard", label: "Dashboard" },
  { href: "/student/team", label: "Team" },
  { href: "/student/decisions", label: "Decisions" },
  { href: "/student/results", label: "Results" },
  { href: "/student/rankings", label: "Rankings" },
  { href: "/student/join", label: "Join" },
];

export default async function StudentLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireRoleSession(["STUDENT"]);
  const userEmail = session.user.email ?? "student@hotelsim.example";
  const userName = session.user.name ?? userEmail;

  return (
    <WorkspaceShell
      role="student"
      userName={userName}
      userEmail={userEmail}
      navItems={studentNavItems}
    >
      {children}
    </WorkspaceShell>
  );
}
