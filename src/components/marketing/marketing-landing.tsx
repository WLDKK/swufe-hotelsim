"use client";

import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  GraduationCap,
  Languages,
  LineChart,
  ShieldCheck,
  Sparkles,
  Telescope,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SupportedLocale } from "@/i18n/messages";
import { useLocale } from "@/i18n/use-locale";
import { cn } from "@/lib/utils";

const roleIcons = [GraduationCap, Telescope, ShieldCheck] as const;
const assuranceIcons = [CheckCircle2, LineChart, Sparkles] as const;

const landingCopy: Record<
  SupportedLocale,
  {
    eyebrow: string;
    brand: string;
    title: string;
    description: string;
    heroNote: string;
    primaryCta: string;
    secondaryCta: string;
    localeLabel: string;
    stats: Array<{
      label: string;
      value: string;
      hint: string;
    }>;
    pillars: Array<{
      title: string;
      body: string;
    }>;
    roles: Array<{
      title: string;
      body: string;
      href: string;
      cta: string;
    }>;
    workflowTitle: string;
    workflow: Array<{
      title: string;
      body: string;
    }>;
    assuranceTitle: string;
    assurance: Array<{
      title: string;
      body: string;
    }>;
  }
> = {
  "zh-CN": {
    eyebrow: "课程实验平台",
    brand: "西南财经大学酒店经营模拟系统",
    title: "面向教学、实验与复盘的一体化酒店经营模拟平台",
    description:
      "围绕课堂组织、团队决策、模拟处理、结果分析与成绩评定建立统一工作流，让学生、教师与管理人员在同一套课程业务流程中协同完成完整实验。",
    heroNote:
      "当前版本适合作为课程演示入口与正式实验门户，支持教师组织实验、学生提交决策，以及管理端维护学期与班级。",
    primaryCta: "进入系统",
    secondaryCta: "查看教师工作区",
    localeLabel: "语言",
    stats: [
      {
        label: "角色入口",
        value: "3 类",
        hint: "学生、教师、管理员均有独立工作区与权限边界。",
      },
      {
        label: "实验闭环",
        value: "全流程",
        hint: "覆盖班级初始化、决策提交、模拟处理、结果复盘与评分。",
      },
      {
        label: "数据链路",
        value: "实时",
        hint: "关键页面已接入稳定的数据读写逻辑，可支持课堂演示与正式实验流程。",
      },
    ],
    pillars: [
      {
        title: "课堂组织更清晰",
        body: "教师可围绕学期、班级、轮次与评分组织整门课程，减少在多个工具之间来回切换。",
      },
      {
        title: "团队协作更顺畅",
        body: "学生围绕同一支队伍完成决策、查看结果、复盘排名，形成连续的经营分析视角。",
      },
      {
        title: "平台治理可持续",
        body: "管理端支持用户、班级、学期与 roster 维护，为后续教学迭代与账号交接预留稳定基础。",
      },
    ],
    roles: [
      {
        title: "学生端",
        body: "聚焦团队经营决策、结果追踪与班级排名，帮助学生理解每轮策略对酒店表现的影响。",
        href: "/student/dashboard",
        cta: "进入学生工作区",
      },
      {
        title: "教师端",
        body: "统一管理学期、班级、模拟运行与评分反馈，适合课堂教学、实验组织与过程复盘。",
        href: "/teacher/dashboard",
        cta: "进入教师工作区",
      },
      {
        title: "管理端",
        body: "负责用户治理、班级配置、roster 维护与平台运营支持，保障实验环境稳定可控。",
        href: "/admin/dashboard",
        cta: "进入管理工作区",
      },
    ],
    workflowTitle: "标准实验流程",
    workflow: [
      {
        title: "教师准备课堂",
        body: "配置学期与班级，建立团队与基础参数，开启实验轮次。",
      },
      {
        title: "学生提交决策",
        body: "团队围绕价格、营销、渠道、运营与融资等维度完成本轮经营方案。",
      },
      {
        title: "系统生成结果",
        body: "模拟引擎处理经营结果，输出收入、利润、入住率与综合表现。",
      },
      {
        title: "教师复盘评分",
        body: "结合结果与过程表现完成点评、评分与教学反馈。",
      },
    ],
    assuranceTitle: "平台呈现重点",
    assurance: [
      {
        title: "正式化视觉",
        body: "首页、认证入口与工作区壳层采用统一品牌语言，适合对外演示与课程展示。",
      },
      {
        title: "结构化信息",
        body: "角色入口、实验流程与系统能力分区明确，便于第一次接触系统的老师或同学快速理解。",
      },
      {
        title: "移动端兼容",
        body: "关键版块保留响应式布局，在电脑与移动设备上均可完成基本浏览与入口跳转。",
      },
    ],
  },
  "en-US": {
    eyebrow: "Course Simulation Platform",
    brand: "SWUFE Hotel Management Simulation",
    title: "A unified hotel simulation platform for teaching, experimentation, and review",
    description:
      "The platform connects course setup, team decisions, simulation processing, result analysis, and grading so students, instructors, and operators can work inside one consistent product.",
    heroNote:
      "This version is designed to serve as a polished course portal for demonstrations, teaching operations, and live experiment runs.",
    primaryCta: "Enter system",
    secondaryCta: "Open teacher workspace",
    localeLabel: "Language",
    stats: [
      {
        label: "Role entry points",
        value: "3",
        hint: "Separate workspaces exist for students, teachers, and admins.",
      },
      {
        label: "Experiment loop",
        value: "End-to-end",
        hint: "Covers initialization, submission, processing, review, and grading.",
      },
      {
        label: "Data flow",
        value: "Live",
        hint: "Key panels already connect to the core data flow used by daily teaching operations.",
      },
    ],
    pillars: [
      {
        title: "Clearer classroom operations",
        body: "Teachers can organize semesters, classes, rounds, and grading without juggling multiple tools.",
      },
      {
        title: "Stronger team collaboration",
        body: "Students stay inside one team-centered workflow for decisions, results, and rankings.",
      },
      {
        title: "Sustainable platform governance",
        body: "Admin capabilities cover users, classes, semesters, and roster maintenance for long-term delivery.",
      },
    ],
    roles: [
      {
        title: "Student",
        body: "Focus on team decisions, performance outcomes, and class rankings to understand strategy impact round by round.",
        href: "/student/dashboard",
        cta: "Open student workspace",
      },
      {
        title: "Teacher",
        body: "Manage semesters, classes, simulation runs, and grading from one teaching-oriented workspace.",
        href: "/teacher/dashboard",
        cta: "Open teacher workspace",
      },
      {
        title: "Admin",
        body: "Maintain users, classes, rosters, and operating support so the course environment stays stable and governable.",
        href: "/admin/dashboard",
        cta: "Open admin workspace",
      },
    ],
    workflowTitle: "Standard experiment flow",
    workflow: [
      {
        title: "Prepare the class",
        body: "Teachers configure semesters, classes, teams, and initial parameters before the experiment starts.",
      },
      {
        title: "Submit decisions",
        body: "Student teams complete operating plans across pricing, marketing, channels, and financing.",
      },
      {
        title: "Run the simulation",
        body: "The engine processes round outputs and returns revenue, profit, occupancy, and other signals.",
      },
      {
        title: "Review and grade",
        body: "Teachers evaluate outcomes, add feedback, and close the learning loop.",
      },
    ],
    assuranceTitle: "Presentation focus",
    assurance: [
      {
        title: "Delivery-ready visuals",
        body: "The landing, auth, and workspace shell now share a cleaner and more formal visual language.",
      },
      {
        title: "Structured information design",
        body: "Role entry points, experiment flow, and core capabilities are separated for faster first-time comprehension.",
      },
      {
        title: "Responsive layout",
        body: "Key sections remain usable on both desktop and mobile displays.",
      },
    ],
  },
};

export function MarketingLanding() {
  // Keep landing-page copy local so we can polish the public entry surface
  // without being blocked by the much larger dashboard message dictionary.
  const { locale, setLocale } = useLocale();
  const copy = landingCopy[locale];

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_15%_12%,rgba(56,189,248,0.18),transparent_18%),radial-gradient(circle_at_84%_10%,rgba(59,130,246,0.16),transparent_18%),radial-gradient(circle_at_50%_100%,rgba(245,158,11,0.1),transparent_24%),linear-gradient(180deg,rgba(5,11,22,0.98),rgba(8,14,27,1)_42%,rgba(3,6,12,1))]">
      <div
        aria-hidden
        className="motion-float pointer-events-none absolute left-[-12rem] top-24 size-[26rem] rounded-full bg-sky-400/20 blur-3xl"
      />
      <div
        aria-hidden
        className="motion-float pointer-events-none absolute right-[-10rem] top-16 size-[24rem] rounded-full bg-amber-300/18 blur-3xl"
        style={{ animationDelay: "1.1s" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[linear-gradient(180deg,rgba(15,23,42,0.54),transparent)]"
      />
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-8 md:px-10 lg:py-12">
        <header className="surface-sheen motion-fade-up flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 shadow-[0_32px_90px_-50px_rgba(2,6,23,0.82)] backdrop-blur-xl md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex size-14 items-center justify-center rounded-[1.3rem] border border-white/10 bg-[linear-gradient(135deg,rgba(56,189,248,0.16),rgba(245,158,11,0.12))] text-sky-100 shadow-[0_20px_40px_-24px_rgba(56,189,248,0.45)]">
              <Building2 className="size-7" />
            </div>
            <div className="space-y-1">
              <Badge className="border-amber-300/20 bg-amber-300/10 text-amber-100 hover:bg-amber-300/10">
                {copy.eyebrow}
              </Badge>
              <p className="text-lg font-semibold tracking-[0.03em] text-white">
                {copy.brand}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-2 text-sm text-slate-300">
              <Languages className="size-4" />
              <span>{copy.localeLabel}</span>
            </div>
            <div className="inline-flex rounded-full border border-white/10 bg-white/6 p-1">
              <button
                type="button"
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm transition",
                  locale === "zh-CN"
                    ? "bg-white text-slate-950"
                    : "text-slate-300 hover:bg-white/10"
                )}
                onClick={() => {
                  setLocale("zh-CN");
                }}
              >
                中文
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm transition",
                  locale === "en-US"
                    ? "bg-white text-slate-950"
                    : "text-slate-300 hover:bg-white/10"
                )}
                onClick={() => {
                  setLocale("en-US");
                }}
              >
                EN
              </button>
            </div>
            <Link
              href="/login"
              className={cn(
                buttonVariants(),
                "rounded-full bg-[linear-gradient(135deg,rgba(14,165,233,0.95),rgba(37,99,235,0.95))] px-5 text-white shadow-[0_20px_40px_-20px_rgba(14,165,233,0.45)] hover:brightness-110"
              )}
            >
              {copy.primaryCta}
            </Link>
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr] content-auto">
          <Card className="surface-sheen motion-fade-up motion-fade-delay-1 overflow-hidden border-white/10 bg-[linear-gradient(140deg,rgba(6,12,24,0.96),rgba(8,17,32,0.95))] shadow-[0_40px_120px_-56px_rgba(2,6,23,0.9)]">
            <CardHeader className="space-y-6 p-8 lg:p-10">
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge className="w-fit rounded-full border border-sky-300/20 bg-sky-300/10 text-sky-100 hover:bg-sky-300/10">
                    SWUFE HotelSim
                  </Badge>
                  <Badge className="w-fit rounded-full border border-amber-300/20 bg-amber-300/10 text-amber-100 hover:bg-amber-300/10">
                    {locale === "zh-CN" ? "教学演示" : "Teaching demo"}
                  </Badge>
                  <Badge className="w-fit rounded-full border border-emerald-300/20 bg-emerald-300/10 text-emerald-100 hover:bg-emerald-300/10">
                    {locale === "zh-CN" ? "比赛承载" : "Competition-ready"}
                  </Badge>
                </div>
                <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                  {copy.title}
                </h1>
                <p className="max-w-3xl text-base leading-8 text-slate-300 sm:text-lg">
                  {copy.description}
                </p>
                <p className="max-w-2xl rounded-[1.5rem] border border-white/10 bg-white/6 px-5 py-4 text-sm leading-7 text-slate-200">
                  {copy.heroNote}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/login"
                  className={cn(
                    buttonVariants(),
                    "gap-2 rounded-full bg-[linear-gradient(135deg,rgba(14,165,233,0.95),rgba(37,99,235,0.95))] px-5 text-white shadow-[0_22px_42px_-22px_rgba(14,165,233,0.45)] transition hover:-translate-y-0.5 hover:brightness-110"
                  )}
                >
                  {copy.primaryCta}
                  <ArrowRight className="size-4" />
                </Link>
                <Link
                  href="/teacher/dashboard"
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "gap-2 rounded-full border-white/12 bg-white/6 px-5 text-slate-100 transition hover:-translate-y-0.5 hover:border-sky-300/30 hover:bg-white/10"
                  )}
                >
                  {copy.secondaryCta}
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 border-t border-white/10 bg-white/[0.03] p-8 md:grid-cols-3">
              {copy.stats.map((item, index) => (
                <div
                  key={item.label}
                  className="interactive-lift motion-fade-up rounded-[1.5rem] border border-white/10 bg-white/6 p-5 shadow-[0_18px_36px_-28px_rgba(2,6,23,0.7)]"
                  style={{ animationDelay: `${180 + index * 90}ms` }}
                >
                  <p className="text-sm text-slate-400">{item.label}</p>
                  <p className="mt-3 text-3xl font-semibold text-white">
                    {item.value}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-300">{item.hint}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="motion-fade-up motion-fade-delay-2 border-white/10 bg-slate-950/60 shadow-[0_32px_90px_-52px_rgba(2,6,23,0.82)]">
            <CardHeader className="space-y-4">
              <Badge className="w-fit rounded-full border border-white/10 bg-white/6 text-slate-200 hover:bg-white/6">
                {copy.workflowTitle}
              </Badge>
              <CardTitle className="text-2xl text-white">
                {locale === "zh-CN"
                  ? "从开课准备到成绩反馈，形成可展示的实验闭环"
                  : "A polished simulation journey from class setup to grading"}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {copy.workflow.map((item, index) => (
                <div
                  key={item.title}
                  className="interactive-lift rounded-[1.5rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.03))] p-5"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    0{index + 1}
                  </p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {item.title}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-300">{item.body}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-3 content-auto">
          {copy.roles.map((role, index) => {
            const Icon = roleIcons[index];

            return (
              <Card
                key={role.title}
                className="interactive-lift motion-fade-up border-white/10 bg-slate-950/60 shadow-[0_30px_90px_-56px_rgba(2,6,23,0.8)]"
                style={{ animationDelay: `${110 + index * 90}ms` }}
              >
                <CardHeader className="space-y-4">
                  <div className="flex size-12 items-center justify-center rounded-[1rem] border border-white/10 bg-[linear-gradient(135deg,rgba(56,189,248,0.16),rgba(255,255,255,0.05))] text-sky-100">
                    <Icon className="size-5" />
                  </div>
                  <CardTitle className="text-2xl text-white">{role.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm leading-7 text-slate-300">{role.body}</p>
                  <Link
                    href={role.href}
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      "w-full gap-2 rounded-full border-white/10 bg-white/6 text-slate-100 transition hover:-translate-y-0.5 hover:border-sky-300/30 hover:bg-white/10"
                    )}
                  >
                    {role.cta}
                    <ArrowRight className="size-4" />
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <section className="grid gap-4 xl:grid-cols-[0.94fr_1.06fr] content-auto">
          <Card className="motion-fade-up border-white/10 bg-slate-950/60 shadow-[0_30px_90px_-56px_rgba(2,6,23,0.82)] motion-fade-delay-1">
            <CardHeader>
              <CardTitle className="text-2xl text-white">
                {copy.assuranceTitle}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {copy.assurance.map((item, index) => {
                const Icon = assuranceIcons[index];

                return (
                  <div
                    key={item.title}
                    className="interactive-lift flex gap-4 rounded-[1.5rem] border border-white/10 bg-white/6 p-5"
                  >
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/8 text-sky-100">
                      <Icon className="size-5" />
                    </div>
                    <div>
                      <p className="text-base font-semibold text-white">{item.title}</p>
                      <p className="mt-2 text-sm leading-7 text-slate-300">{item.body}</p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="surface-sheen motion-fade-up border-white/10 bg-[linear-gradient(135deg,rgba(7,16,31,0.98),rgba(18,25,45,0.95))] text-white shadow-[0_30px_90px_-46px_rgba(2,6,23,0.88)] motion-fade-delay-2">
            <CardHeader className="space-y-4">
              <Badge className="w-fit rounded-full border border-white/15 bg-white/8 text-white hover:bg-white/8">
                {locale === "zh-CN" ? "系统能力" : "System capabilities"}
              </Badge>
              <CardTitle className="text-2xl text-white">
                {locale === "zh-CN"
                  ? "适合课堂展示，也适合正式实验运行"
                  : "Designed for both live demos and formal class delivery"}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm leading-7 text-slate-200">
              {copy.pillars.map((pillar) => (
                <div
                  key={pillar.title}
                  className="rounded-[1.5rem] border border-white/10 bg-white/6 p-5"
                >
                  <p className="text-base font-semibold text-white">{pillar.title}</p>
                  <p className="mt-2">{pillar.body}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      </section>
    </main>
  );
}
