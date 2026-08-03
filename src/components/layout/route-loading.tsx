import { Building2, ShieldCheck, Sparkles, Telescope } from "lucide-react";

type RouteLoadingVariant = "public" | "auth" | "display" | "dashboard";

type RouteLoadingProps = {
  variant: RouteLoadingVariant;
};

const loadingCopy: Record<
  RouteLoadingVariant,
  {
    badge: string;
    title: string;
    description: string;
  }
> = {
  public: {
    badge: "SWUFE HotelSim",
    title: "正在加载首页内容",
    description: "为你准备课程入口、角色工作区与项目概览。",
  },
  auth: {
    badge: "统一认证",
    title: "正在加载登录与认证界面",
    description: "正在准备账号入口、体验账号说明与认证表单。",
  },
  display: {
    badge: "公开展示",
    title: "正在加载公开展示页",
    description: "正在读取比赛概览、排行榜与公告信息。",
  },
  dashboard: {
    badge: "工作区",
    title: "正在加载业务工作区",
    description: "正在准备当前角色的导航、数据摘要与主面板。",
  },
};

const variantToneClass: Record<RouteLoadingVariant, string> = {
  public:
    "bg-[radial-gradient(circle_at_14%_14%,rgba(56,189,248,0.16),transparent_20%),radial-gradient(circle_at_84%_10%,rgba(59,130,246,0.12),transparent_18%),linear-gradient(180deg,rgba(5,11,22,1),rgba(8,14,27,1)_42%,rgba(3,6,12,1))]",
  auth:
    "bg-[radial-gradient(circle_at_14%_14%,rgba(56,189,248,0.16),transparent_20%),radial-gradient(circle_at_84%_18%,rgba(59,130,246,0.14),transparent_18%),radial-gradient(circle_at_78%_86%,rgba(245,158,11,0.08),transparent_22%),linear-gradient(135deg,#050b16_0%,#08111f_46%,#04070d_100%)]",
  display:
    "bg-[radial-gradient(circle_at_14%_14%,rgba(14,165,233,0.16),transparent_20%),radial-gradient(circle_at_84%_10%,rgba(59,130,246,0.12),transparent_18%),radial-gradient(circle_at_50%_100%,rgba(245,158,11,0.08),transparent_24%),linear-gradient(180deg,rgba(5,11,22,1),rgba(8,14,27,1)_42%,rgba(3,6,12,1))]",
  dashboard:
    "bg-[radial-gradient(circle_at_18%_14%,rgba(56,189,248,0.13),transparent_20%),radial-gradient(circle_at_84%_12%,rgba(59,130,246,0.12),transparent_20%),linear-gradient(180deg,rgba(5,11,22,1),rgba(8,14,27,1)_42%,rgba(3,6,12,1))]",
};

function SkeletonBlock({
  className,
}: Readonly<{
  className: string;
}>) {
  return (
    <div
      className={`animate-pulse rounded-2xl bg-[linear-gradient(90deg,rgba(30,41,59,0.9),rgba(51,65,85,0.95),rgba(30,41,59,0.9))] ${className}`}
    />
  );
}

export function RouteLoading({ variant }: RouteLoadingProps) {
  const copy = loadingCopy[variant];
  const icon =
    variant === "dashboard"
      ? ShieldCheck
      : variant === "display"
        ? Telescope
        : variant === "auth"
          ? Sparkles
          : Building2;
  const Icon = icon;

  return (
    <main className={`min-h-screen ${variantToneClass[variant]}`}>
      <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-6 py-8 md:px-10 lg:py-12">
        <div className="surface-sheen overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 shadow-[0_32px_90px_-50px_rgba(2,6,23,0.82)] backdrop-blur-xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-3 rounded-full border border-sky-300/20 bg-sky-300/10 px-4 py-2 text-sm font-medium text-sky-100">
                <Icon className="size-4" />
                <span>{copy.badge}</span>
              </div>
              <div className="space-y-3">
                <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  {copy.title}
                </h1>
                <p className="max-w-2xl text-sm leading-7 text-slate-300">
                  {copy.description}
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[22rem]">
              <SkeletonBlock className="h-12" />
              <SkeletonBlock className="h-12" />
              <SkeletonBlock className="h-12" />
            </div>
          </div>
        </div>

        <div
          className={
            variant === "auth"
              ? "grid gap-6 lg:grid-cols-[1.04fr_0.96fr]"
              : "grid gap-6 xl:grid-cols-[1.08fr_0.92fr]"
          }
        >
          <div className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 shadow-[0_30px_80px_-44px_rgba(2,6,23,0.82)]">
            <div className="space-y-4">
              <SkeletonBlock className="h-8 w-40" />
              <SkeletonBlock className="h-14 w-full max-w-3xl" />
              <SkeletonBlock className="h-4 w-full" />
              <SkeletonBlock className="h-4 w-[92%]" />
              <SkeletonBlock className="h-28 w-full" />
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <SkeletonBlock className="h-32" />
              <SkeletonBlock className="h-32" />
              <SkeletonBlock className="h-32" />
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-slate-950/55 p-6 shadow-[0_30px_72px_-44px_rgba(2,6,23,0.82)]">
            <div className="space-y-4">
              <SkeletonBlock className="h-6 w-28" />
              <SkeletonBlock className="h-12 w-full" />
              <SkeletonBlock className="h-12 w-full" />
              <SkeletonBlock className="h-12 w-full" />
              <SkeletonBlock className="h-24 w-full" />
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <SkeletonBlock className="h-44" />
          <SkeletonBlock className="h-44" />
          <SkeletonBlock className="h-44" />
        </div>
      </section>
    </main>
  );
}
