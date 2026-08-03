import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { requireRoleSession } from "@/lib/auth/guards";

const teacherNavItems = [
  { href: "/teacher/dashboard", label: "Dashboard" },
  { href: "/teacher/semesters", label: "Semesters" },
  { href: "/teacher/classes", label: "Classes" },
  { href: "/teacher/simulation", label: "Simulation" },
  { href: "/teacher/grading", label: "Grading" },
];

export default async function TeacherLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireRoleSession(["TEACHER"]);
  const userEmail = session.user.email ?? "teacher@hotelsim.example";
  const userName = session.user.name ?? userEmail;

  return (
    <WorkspaceShell
      role="teacher"
      userName={userName}
      userEmail={userEmail}
      navItems={teacherNavItems}
    >
      {children}
    </WorkspaceShell>
  );
}
