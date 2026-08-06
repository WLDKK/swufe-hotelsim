"use client";

import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Building2,
  ClipboardCheck,
  Languages,
  MonitorUp,
  Scale,
  UsersRound,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { SupportedLocale } from "@/i18n/messages";
import { useLocale } from "@/i18n/use-locale";
import { cn } from "@/lib/utils";

const copy: Record<SupportedLocale, {
  nav: string[];
  login: string;
  display: string;
  eyebrow: string;
  title: string;
  lead: string;
  primary: string;
  secondary: string;
  previewLabel: string;
  previewTitle: string;
  previewRound: string;
  previewRows: Array<[string, string, string]>;
  capabilityTitle: string;
  capabilityLead: string;
  capabilities: Array<{ title: string; body: string }>;
  flowTitle: string;
  flow: Array<{ title: string; body: string }>;
  footer: string;
}> = {
  "zh-CN": {
    nav: ["赛事能力", "运行流程", "公开赛况"],
    login: "登录",
    display: "公开赛况",
    eyebrow: "西南财经大学 · 酒店经营模拟",
    title: "把经营判断，放进一场可验证的比赛。",
    lead: "HotelSim 将定价、营销、渠道、运营、融资与 ESG 决策汇入同一套回合制引擎，为课程实验与经营管理竞赛提供可追溯的全过程平台。",
    primary: "进入参赛工作台",
    secondary: "查看公开赛况",
    previewLabel: "赛事运行示例",
    previewTitle: "酒店经营挑战赛",
    previewRound: "决赛 · 第 4 回合",
    previewRows: [
      ["01", "远见酒店管理队", "86.4"],
      ["02", "锦程运营实验室", "84.9"],
      ["03", "新域旅业团队", "82.7"],
    ],
    capabilityTitle: "为真实赛事组织，而不是只为一次演示",
    capabilityLead: "角色、轮次、规则、评分和公开传播形成统一业务链，关键操作保留审计记录。",
    capabilities: [
      { title: "团队经营决策", body: "围绕价格、营销、渠道、运营、资本与 ESG 完成回合决策，并保留提交状态。" },
      { title: "可复现实验引擎", body: "规则版本、参数快照与随机种子随回合固化，便于复盘与争议核验。" },
      { title: "赛事评分治理", body: "系统分与评委分分轨记录；评委只访问获分配赛事，评分过程可审计。" },
      { title: "公开赛况传播", body: "面向观众提供排行榜、赛事公告与回合环境，不暴露后台权限与敏感数据。" },
    ],
    flowTitle: "一条清晰的赛事主线",
    flow: [
      { title: "组织赛事", body: "建立赛事、阶段、规则版本与评委分配。" },
      { title: "团队决策", body: "参赛队在截止时间前协作并提交经营方案。" },
      { title: "运行回合", body: "引擎原子领取任务，计算并固化本轮结果。" },
      { title: "评分与公示", body: "评委评分汇总后，通过公开端同步赛况。" },
    ],
    footer: "SWUFE HotelSim · 酒店经营模拟教学与竞赛平台",
  },
  "en-US": {
    nav: ["Competition", "Workflow", "Live display"],
    login: "Sign in",
    display: "Live display",
    eyebrow: "SWUFE · Hotel Management Simulation",
    title: "Turn management judgment into a competition you can verify.",
    lead: "HotelSim brings pricing, marketing, channels, operations, finance, and ESG decisions into one round-based engine for coursework and management competitions.",
    primary: "Open competition workspace",
    secondary: "View live display",
    previewLabel: "Competition example",
    previewTitle: "Hotel Management Challenge",
    previewRound: "Final · Round 4",
    previewRows: [
      ["01", "Vision Hotel Team", "86.4"],
      ["02", "Jincheng Operations Lab", "84.9"],
      ["03", "New Horizon Hospitality", "82.7"],
    ],
    capabilityTitle: "Built for an operating competition, not a one-off demo",
    capabilityLead: "Roles, rounds, rules, scoring, and public communication form one auditable workflow.",
    capabilities: [
      { title: "Team decisions", body: "Teams decide across pricing, marketing, channels, operations, capital, and ESG with explicit submission states." },
      { title: "Reproducible engine", body: "Rule versions, parameter snapshots, and random seeds are preserved with every round." },
      { title: "Scoring governance", body: "System and judge scores stay separate; judges only access assigned competitions." },
      { title: "Public communication", body: "Leaderboards, announcements, and round context are published without exposing private operations." },
    ],
    flowTitle: "One clear competition journey",
    flow: [
      { title: "Set up", body: "Create the competition, stages, ruleset, and judge assignments." },
      { title: "Decide", body: "Teams collaborate and submit an operating plan before the deadline." },
      { title: "Simulate", body: "The engine atomically claims, computes, and records the round." },
      { title: "Score and publish", body: "Judge input is aggregated and the public display updates." },
    ],
    footer: "SWUFE HotelSim · Teaching and competition platform",
  },
};

const capabilityIcons = [ClipboardCheck, BarChart3, Scale, MonitorUp] as const;

export function MarketingLanding() {
  const { locale, setLocale } = useLocale();
  const text = copy[locale];

  return (
    <main className="min-h-screen bg-swufe-cream text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-20 w-full max-w-7xl items-center justify-between gap-6 px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="SWUFE HotelSim 首页">
            <span className="grid size-11 place-items-center rounded-lg bg-swufe-red text-sm font-bold tracking-wider text-white">财</span>
            <span>
              <span className="block text-base font-bold tracking-tight text-swufe-blue">SWUFE HotelSim</span>
              <span className="block text-xs text-slate-500">酒店经营模拟平台</span>
            </span>
          </Link>

          <nav aria-label="首页导航" className="hidden items-center gap-8 text-sm font-medium text-slate-600 lg:flex">
            <a href="#capabilities" className="hover:text-swufe-red">{text.nav[0]}</a>
            <a href="#workflow" className="hover:text-swufe-red">{text.nav[1]}</a>
            <Link href="/display" className="hover:text-swufe-red">{text.nav[2]}</Link>
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLocale(locale === "zh-CN" ? "en-US" : "zh-CN")}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-slate-600 hover:bg-slate-100"
              aria-label={locale === "zh-CN" ? "Switch to English" : "切换为中文"}
            >
              <Languages className="size-4" />
              {locale === "zh-CN" ? "EN" : "中文"}
            </button>
            <Link href="/login" className={cn(buttonVariants({ variant: "outline" }), "hidden sm:inline-flex")}>{text.login}</Link>
          </div>
        </div>
      </header>

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid w-full max-w-7xl gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="motion-fade-up">
            <p className="text-sm font-bold tracking-[0.14em] text-swufe-red">{text.eyebrow}</p>
            <h1 className="mt-5 max-w-3xl text-balance text-4xl font-bold leading-[1.12] tracking-tight text-swufe-blue sm:text-6xl">
              {text.title}
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">{text.lead}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/login" className={cn(buttonVariants({ size: "lg" }), "gap-2")}>{text.primary}<ArrowRight className="size-4" /></Link>
              <Link href="/display" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "gap-2")}>{text.secondary}<MonitorUp className="size-4" /></Link>
            </div>
          </div>

          <div className="motion-fade-up overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_24px_70px_-36px_rgba(27,58,92,0.4)] motion-fade-delay-1">
            <div className="flex items-center justify-between bg-swufe-blue px-6 py-5 text-white">
              <div>
                <p className="text-xs font-semibold tracking-[0.12em] text-slate-300">{text.previewLabel}</p>
                <p className="mt-1 text-lg font-bold">{text.previewTitle}</p>
              </div>
              <span className="rounded-full border border-white/20 px-3 py-1 text-xs">{text.previewRound}</span>
            </div>
            <div className="border-b border-slate-200 bg-swufe-cream px-6 py-4 text-sm font-medium text-swufe-blue">综合经营得分 / Overall score</div>
            <div className="divide-y divide-slate-100 px-6">
              {text.previewRows.map(([rank, name, score]) => (
                <div key={rank} className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 py-5">
                  <span className={cn("text-sm font-bold", rank === "01" ? "text-swufe-red" : "text-slate-400")}>{rank}</span>
                  <span className="font-semibold text-swufe-blue">{name}</span>
                  <span className="font-mono text-lg font-bold tabular-nums text-slate-900">{score}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 border-t border-slate-200 bg-slate-50 text-center text-xs text-slate-500">
              {["经营质量", "财务韧性", "可持续表现"].map((item) => <span key={item} className="px-2 py-4">{item}</span>)}
            </div>
          </div>
        </div>
      </section>

      <section id="capabilities" className="mx-auto w-full max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="max-w-3xl">
          <p className="text-sm font-bold tracking-[0.14em] text-swufe-red">COMPETITION OPERATIONS</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-swufe-blue sm:text-4xl">{text.capabilityTitle}</h2>
          <p className="mt-4 leading-7 text-slate-600">{text.capabilityLead}</p>
        </div>
        <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 md:grid-cols-2">
          {text.capabilities.map((item, index) => {
            const Icon = capabilityIcons[index];
            return (
              <article key={item.title} className="bg-white p-7 sm:p-8">
                <Icon className="size-6 text-swufe-red" aria-hidden="true" />
                <h3 className="mt-5 text-xl font-bold text-swufe-blue">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section id="workflow" className="bg-swufe-blue text-white">
        <div className="mx-auto w-full max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="flex items-center gap-3"><Building2 className="size-6 text-swufe-gold" /><h2 className="text-3xl font-bold">{text.flowTitle}</h2></div>
          <ol className="mt-10 grid gap-8 md:grid-cols-4">
            {text.flow.map((item, index) => (
              <li key={item.title} className="border-t border-white/25 pt-5">
                <span className="font-mono text-sm text-swufe-gold">0{index + 1}</span>
                <h3 className="mt-3 text-lg font-bold">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{item.body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-12 flex flex-wrap items-center gap-4 border-t border-white/15 pt-8">
            <UsersRound className="size-5 text-swufe-gold" />
            <p className="text-sm text-slate-300">学生 · 教师 · 赛事管理员 · 评委 · 观众</p>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex min-h-20 w-full max-w-7xl flex-col justify-center gap-2 px-5 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>{text.footer}</p>
          <Link href="/display" className="font-semibold text-swufe-red hover:underline">{text.display}</Link>
        </div>
      </footer>
    </main>
  );
}
