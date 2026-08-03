import type { WorkspaceHeroProps } from "@/components/layout/workspace-hero";
import { WorkspaceHero } from "@/components/layout/workspace-hero";

type TeacherWorkspaceHeroProps = Omit<WorkspaceHeroProps, "theme">;

export function TeacherWorkspaceHero({
  badgeLabel,
  title,
  description,
  statusTitle,
  statusBody,
  summaryItems,
  actions,
  statusFooter,
}: TeacherWorkspaceHeroProps) {
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
          "border-sky-400/15 bg-[linear-gradient(135deg,rgba(8,15,28,0.94),rgba(8,24,38,0.94))] shadow-[0_34px_90px_-50px_rgba(14,165,233,0.42)]",
        badgeClassName:
          "border-sky-400/20 bg-sky-300/10 text-sky-100 hover:bg-sky-300/10",
        summaryCardClassName: "border-white/10 bg-white/6",
        secondaryCardClassName:
          "border-sky-400/15 bg-[linear-gradient(180deg,rgba(7,14,24,0.9),rgba(8,22,34,0.92))] shadow-[0_34px_90px_-52px_rgba(14,165,233,0.4)]",
        actionClassName:
          "border-white/10 bg-white/6 text-slate-100 hover:border-sky-400/25 hover:bg-white/10",
      }}
    />
  );
}
