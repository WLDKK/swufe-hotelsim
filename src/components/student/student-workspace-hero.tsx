import type { WorkspaceHeroProps } from "@/components/layout/workspace-hero";
import { WorkspaceHero } from "@/components/layout/workspace-hero";

type StudentWorkspaceHeroProps = Omit<WorkspaceHeroProps, "theme">;

export function StudentWorkspaceHero({
  badgeLabel,
  title,
  description,
  statusTitle,
  statusBody,
  summaryItems,
  actions,
  statusFooter,
}: StudentWorkspaceHeroProps) {
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
          "border-amber-400/15 bg-[linear-gradient(135deg,rgba(10,16,29,0.94),rgba(23,12,17,0.94))] shadow-[0_34px_90px_-50px_rgba(245,158,11,0.45)]",
        badgeClassName:
          "border-amber-400/20 bg-amber-300/10 text-amber-100 hover:bg-amber-300/10",
        summaryCardClassName: "border-white/10 bg-white/6",
        secondaryCardClassName:
          "border-amber-400/15 bg-[linear-gradient(180deg,rgba(8,14,24,0.9),rgba(18,12,20,0.92))] shadow-[0_34px_90px_-52px_rgba(245,158,11,0.42)]",
        actionClassName:
          "border-white/10 bg-white/6 text-slate-100 hover:border-amber-400/25 hover:bg-white/10",
      }}
    />
  );
}
