import { JudgeShell } from "@/components/judge/judge-shell";
import { requireRoleSession } from "@/lib/auth/guards";

export default async function JudgeLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireRoleSession(["JUDGE"]);
  const userEmail = session.user.email ?? "judge@hotelsim.example";
  const userName = session.user.name ?? userEmail;

  return (
    <JudgeShell userName={userName} userEmail={userEmail}>
      {children}
    </JudgeShell>
  );
}
