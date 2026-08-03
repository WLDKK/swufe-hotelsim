import { cn } from "@/lib/utils";

type ChartLoadingSkeletonProps = {
  className?: string;
};

// Keep lazy chart regions visually stable while the heavier Recharts bundles
// load, so dashboards do not jump between blank cards and final charts.
export function ChartLoadingSkeleton({
  className,
}: ChartLoadingSkeletonProps) {
  return (
    <div
      className={cn(
        "surface-sheen overflow-hidden rounded-[1.5rem] border border-dashed border-white/10 bg-[linear-gradient(145deg,rgba(8,14,24,0.92),rgba(16,23,38,0.88))] p-4",
        className
      )}
    >
      <div className="flex h-full flex-col justify-between gap-4">
        <div className="space-y-3">
          <div className="h-3 w-24 animate-pulse rounded-full bg-slate-600" />
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="h-2 w-full animate-pulse rounded-full bg-slate-700" />
            <div className="h-2 w-full animate-pulse rounded-full bg-slate-700" />
            <div className="h-2 w-full animate-pulse rounded-full bg-slate-700" />
          </div>
        </div>
        <div className="flex h-full items-end gap-3">
          <div className="h-[42%] flex-1 animate-pulse rounded-t-[1rem] bg-slate-600/70" />
          <div className="h-[68%] flex-1 animate-pulse rounded-t-[1rem] bg-slate-500/75" />
          <div className="h-[54%] flex-1 animate-pulse rounded-t-[1rem] bg-slate-600/70" />
          <div className="h-[80%] flex-1 animate-pulse rounded-t-[1rem] bg-slate-500/75" />
          <div className="h-[60%] flex-1 animate-pulse rounded-t-[1rem] bg-slate-600/70" />
        </div>
      </div>
    </div>
  );
}
