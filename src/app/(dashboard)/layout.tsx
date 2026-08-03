export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The dashboard route group now only owns the atmospheric background. Each
    // role-specific layout renders the real shared workspace shell, which
    // avoids duplicate headers while keeping one visual foundation.
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.12),transparent_28%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.12),transparent_30%),linear-gradient(180deg,rgba(248,250,252,0.98),rgba(241,245,249,0.95))]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[linear-gradient(180deg,rgba(255,255,255,0.85),transparent)]" />
      <div className="pointer-events-none absolute left-[-8rem] top-40 size-64 rounded-full bg-amber-300/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-10 right-[-8rem] size-72 rounded-full bg-sky-300/10 blur-3xl" />
      <div className="relative">{children}</div>
    </div>
  );
}
