import type { WorkspaceHeroProps } from "@/components/layout/workspace-hero";
import { WorkspaceHero } from "@/components/layout/workspace-hero";

type AdminWorkspaceHeroProps = Omit<WorkspaceHeroProps, "theme">;

export function AdminWorkspaceHero({
  badgeLabel,
  title,
  description,
  statusTitle,
  statusBody,
  summaryItems,
  actions,
  statusFooter,
}: AdminWorkspaceHeroProps) {
  return (
    <WorkspaceHero
      badgeLabel={badgeLabel}
      title={title}
      description={description}
      statusTitle={statusTitle}
      statusBody={statusBody}
      summaryItems={summaryItems}
      actions={actions}
      statusFooter={statusFooter}
      theme={{
        primaryCardClassName:
          "border-slate-300/15 bg-[linear-gradient(135deg,rgba(8,14,25,0.94),rgba(20,17,25,0.94))] shadow-[0_34px_90px_-50px_rgba(148,163,184,0.34)]",
        badgeClassName:
          "border-amber-300/18 bg-amber-300/10 text-amber-100 hover:bg-amber-300/10",
        summaryCardClassName: "border-white/10 bg-white/6",
        secondaryCardClassName:
          "border-slate-300/15 bg-[linear-gradient(180deg,rgba(8,13,23,0.9),rgba(17,16,24,0.92))] shadow-[0_34px_90px_-52px_rgba(15,23,42,0.56)]",
        actionClassName:
          "border-white/10 bg-white/6 text-slate-100 hover:border-amber-300/20 hover:bg-white/10",
      }}
    />
  );
}
