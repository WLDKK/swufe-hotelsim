"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  formatCompactCurrency,
  formatNumber,
  formatPercent,
} from "@/lib/formatters";

type SupportedLocale = "zh-CN" | "en-US";

type ExplanationLog = {
  financials?: {
    ancillaryRevenueRatio?: number;
    directMix?: number;
    propertyTaxExpense?: number;
    vatExpense?: number;
    incomeTaxExpense?: number;
  };
  operations?: {
    serviceCapacityScore?: number;
    serviceStress?: number;
    laborOvertimeFactor?: number;
    weatherUtilityPressure?: number;
    turnoverLoadIndex?: number;
    demandCompressionIndex?: number;
  };
  scoreHighlights?: {
    strongestMetric?: {
      label?: string;
      contribution?: number;
    } | null;
    weakestMetric?: {
      label?: string;
      contribution?: number;
    } | null;
  };
  segmentHighlights?: {
    strongest?: {
      segmentName?: string;
      revenue?: number;
      roomsSold?: number;
    } | null;
    weakest?: {
      segmentName?: string;
      revenue?: number;
      roomsSold?: number;
    } | null;
  };
};

type ResultExplanationCardsProps = {
  locale: SupportedLocale;
  latestResult: {
    totalRevenue: number;
    netProfit: number;
    occupancyRate: number;
    overallMarketShare: number;
    systemScore: number;
    explanationLog?: Record<string, unknown> | null;
  };
};

function t(locale: SupportedLocale, zh: string, en: string) {
  return locale === "zh-CN" ? zh : en;
}

function safeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function ResultExplanationCards({
  locale,
  latestResult,
}: ResultExplanationCardsProps) {
  const zh = locale === "zh-CN";
  const log = (latestResult.explanationLog ?? {}) as ExplanationLog;
  const strongestMetric = log.scoreHighlights?.strongestMetric ?? null;
  const weakestMetric = log.scoreHighlights?.weakestMetric ?? null;
  const strongestSegment = log.segmentHighlights?.strongest ?? null;
  const weakestSegment = log.segmentHighlights?.weakest ?? null;
  const ancillaryRevenueRatio = safeNumber(log.financials?.ancillaryRevenueRatio);
  const directMix = safeNumber(log.financials?.directMix);
  const serviceStress = safeNumber(log.operations?.serviceStress);
  const serviceCapacityScore = safeNumber(log.operations?.serviceCapacityScore);
  const weatherUtilityPressure = safeNumber(log.operations?.weatherUtilityPressure);
  const turnoverLoadIndex = safeNumber(log.operations?.turnoverLoadIndex);
  const demandCompressionIndex = safeNumber(log.operations?.demandCompressionIndex);

  const summaryTitle =
    strongestMetric?.label && strongestMetric?.contribution
      ? t(
          locale,
          `本轮最强得分项是 ${strongestMetric.label}`,
          `Strongest scoring driver: ${strongestMetric.label}`
        )
      : t(locale, "本轮经营战报", "Round debrief");

  const summaryBody = serviceStress && serviceStress > 0.08
    ? t(
        locale,
        "这一轮不是单纯的价格问题，更像是高负荷下的服务兑现压力开始拖累结果。",
        "This round looks more constrained by service execution under pressure than by pricing alone."
      )
    : demandCompressionIndex && demandCompressionIndex > 1
      ? t(
          locale,
          "房量进入压缩区后，系统已经开始按收益优先级做位移分配，高收益客群表现会更关键。",
          "Inventory entered compression, so higher-yield segments mattered more this round."
        )
      : t(
          locale,
          "这一轮整体表现更偏稳健，结果主要由收入结构、得分权重和基础运营质量共同驱动。",
          "This round was relatively stable, driven by mix, scoring weights, and operating quality."
        );

  const nextMove = serviceStress && serviceStress > 0.08
    ? t(
        locale,
        "下一轮优先补前厅、客房、培训与福利，不然继续冲量可能只会放大利润波动。",
        "Raise front desk, housekeeping, training, and welfare before pushing harder next round."
      )
    : directMix !== null && directMix < 0.4
      ? t(
          locale,
          "下一轮可以尝试把更多预算和渠道重心转回直连/企业协议，改善净收益质量。",
          "Next round can shift more mix toward direct and corporate channels."
        )
      : t(
          locale,
          "下一轮可以围绕当前强势客群继续加码，但要避免把资源过度平均摊薄。",
          "Double down on your strongest segment next round instead of spreading effort too thin."
        );

  return (
    <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
      <Card className="border-sky-400/20 bg-[linear-gradient(145deg,rgba(2,6,23,0.94),rgba(15,23,42,0.88))] text-slate-50 shadow-[0_28px_80px_-42px_rgba(14,165,233,0.28)]">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border border-sky-300/30 bg-sky-400/10 text-sky-100">
              {zh ? "结果解释卡" : "Result explainer"}
            </Badge>
            <Badge className="border border-white/10 bg-white/10 text-slate-100">
              {zh ? "系统已自动生成" : "Auto-generated"}
            </Badge>
          </div>
          <CardTitle className="text-2xl text-white">{summaryTitle}</CardTitle>
          <CardDescription className="text-slate-300">
            {summaryBody}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="rounded-[1.2rem] border border-white/10 bg-white/6 p-4">
            <p className="text-sm text-slate-300">{zh ? "附加收入占比" : "Ancillary mix"}</p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {ancillaryRevenueRatio !== null ? formatPercent(ancillaryRevenueRatio) : "-"}
            </p>
            <p className="mt-2 text-xs leading-6 text-slate-300">
              {zh
                ? "反映餐饮与其他收入对房费之外的支撑程度。"
                : "Shows how much non-room revenue supported the round."}
            </p>
          </div>
          <div className="rounded-[1.2rem] border border-white/10 bg-white/6 p-4">
            <p className="text-sm text-slate-300">{zh ? "直连收益占比" : "Direct-led mix"}</p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {directMix !== null ? formatPercent(directMix) : "-"}
            </p>
            <p className="mt-2 text-xs leading-6 text-slate-300">
              {zh
                ? "越高通常代表净收益质量更好，但也要求品牌和转化能力跟上。"
                : "Higher direct-led mix often means better net yield quality."}
            </p>
          </div>
          <div className="rounded-[1.2rem] border border-white/10 bg-white/6 p-4">
            <p className="text-sm text-slate-300">{zh ? "服务承压" : "Service stress"}</p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {serviceStress !== null ? formatNumber(serviceStress) : "-"}
            </p>
            <p className="mt-2 text-xs leading-6 text-slate-300">
              {zh
                ? "数值越高说明高入住和人力兑现之间的张力越明显。"
                : "Higher means occupancy is pushing harder against staffing support."}
            </p>
          </div>
          <div className="rounded-[1.2rem] border border-white/10 bg-white/6 p-4">
            <p className="text-sm text-slate-300">{zh ? "容量压缩指数" : "Compression index"}</p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {demandCompressionIndex !== null
                ? formatNumber(demandCompressionIndex)
                : "-"}
            </p>
            <p className="mt-2 text-xs leading-6 text-slate-300">
              {zh
                ? "高于 1 说明房量已进入紧张区，收益管理位移会变得更重要。"
                : "Above 1 means inventory was tight and displacement mattered more."}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        <Card className="border-border/70 bg-background/95 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">
              {zh ? "本轮亮点与拖累" : "Best and weakest drivers"}
            </CardTitle>
            <CardDescription>
              {zh
                ? "系统会自动识别得分端和客群端最值得关注的两个方向。"
                : "Highlights come from both scoring and segment performance."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-[1.15rem] border border-emerald-300/30 bg-emerald-500/10 px-4 py-3">
              <p className="text-sm font-semibold text-emerald-100">
                {zh ? "最强加分项" : "Top lift"}
              </p>
              <p className="mt-1 text-sm text-emerald-50">
                {strongestMetric?.label ?? (zh ? "暂无" : "Not available")}
              </p>
              <p className="mt-1 text-xs text-emerald-100/80">
                {zh ? "贡献值" : "Contribution"}{" "}
                {strongestMetric?.contribution !== undefined
                  ? formatNumber(strongestMetric.contribution)
                  : "-"}
              </p>
            </div>
            <div className="rounded-[1.15rem] border border-rose-300/30 bg-rose-500/10 px-4 py-3">
              <p className="text-sm font-semibold text-rose-100">
                {zh ? "最弱拖累项" : "Primary drag"}
              </p>
              <p className="mt-1 text-sm text-rose-50">
                {weakestMetric?.label ?? (zh ? "暂无" : "Not available")}
              </p>
              <p className="mt-1 text-xs text-rose-100/80">
                {zh ? "贡献值" : "Contribution"}{" "}
                {weakestMetric?.contribution !== undefined
                  ? formatNumber(weakestMetric.contribution)
                  : "-"}
              </p>
            </div>
            <div className="rounded-[1.15rem] border border-slate-200/70 bg-slate-50/80 px-4 py-3">
              <p className="text-sm font-semibold text-slate-950">
                {zh ? "最强客群" : "Top segment"}
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {strongestSegment?.segmentName ?? (zh ? "暂无" : "Not available")}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {zh ? "收入" : "Revenue"}{" "}
                {strongestSegment?.revenue !== undefined
                  ? formatCompactCurrency(strongestSegment.revenue)
                  : "-"}
              </p>
            </div>
            <div className="rounded-[1.15rem] border border-slate-200/70 bg-slate-50/80 px-4 py-3">
              <p className="text-sm font-semibold text-slate-950">
                {zh ? "最弱客群" : "Weakest segment"}
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {weakestSegment?.segmentName ?? (zh ? "暂无" : "Not available")}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {zh ? "收入" : "Revenue"}{" "}
                {weakestSegment?.revenue !== undefined
                  ? formatCompactCurrency(weakestSegment.revenue)
                  : "-"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-background/95 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">
              {zh ? "运营信号" : "Operating signals"}
            </CardTitle>
            <CardDescription>
              {zh
                ? "这几个指标最适合拿来解释“为什么结果会这样”。"
                : "These signals explain why the round behaved the way it did."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[1.15rem] border border-slate-200/70 bg-slate-50/80 px-4 py-3">
              <p className="text-xs text-slate-500">{zh ? "服务能力分" : "Service capacity"}</p>
              <p className="mt-1 text-lg font-semibold text-slate-950">
                {serviceCapacityScore !== null ? formatNumber(serviceCapacityScore) : "-"}
              </p>
            </div>
            <div className="rounded-[1.15rem] border border-slate-200/70 bg-slate-50/80 px-4 py-3">
              <p className="text-xs text-slate-500">{zh ? "天气能耗压力" : "Weather utility pressure"}</p>
              <p className="mt-1 text-lg font-semibold text-slate-950">
                {weatherUtilityPressure !== null ? formatNumber(weatherUtilityPressure) : "-"}
              </p>
            </div>
            <div className="rounded-[1.15rem] border border-slate-200/70 bg-slate-50/80 px-4 py-3">
              <p className="text-xs text-slate-500">{zh ? "周转负荷" : "Turnover load"}</p>
              <p className="mt-1 text-lg font-semibold text-slate-950">
                {turnoverLoadIndex !== null ? formatNumber(turnoverLoadIndex) : "-"}
              </p>
            </div>
            <div className="rounded-[1.15rem] border border-slate-200/70 bg-slate-50/80 px-4 py-3">
              <p className="text-xs text-slate-500">{zh ? "综合得分" : "System score"}</p>
              <p className="mt-1 text-lg font-semibold text-slate-950">
                {formatNumber(latestResult.systemScore)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-background/95 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">
              {zh ? "下一轮建议" : "Next-round suggestion"}
            </CardTitle>
            <CardDescription>
              {zh
                ? "基于当前结果链给出的下一步动作建议。"
                : "The most actionable follow-up based on the current round."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-[1.15rem] border border-sky-200/70 bg-sky-50/70 px-4 py-3 text-sm leading-7 text-slate-700">
              {nextMove}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[1.15rem] border border-slate-200/70 bg-slate-50/80 px-4 py-3">
                <p className="text-xs text-slate-500">{zh ? "营收" : "Revenue"}</p>
                <p className="mt-1 text-lg font-semibold text-slate-950">
                  {formatCompactCurrency(latestResult.totalRevenue)}
                </p>
              </div>
              <div className="rounded-[1.15rem] border border-slate-200/70 bg-slate-50/80 px-4 py-3">
                <p className="text-xs text-slate-500">{zh ? "利润" : "Profit"}</p>
                <p className="mt-1 text-lg font-semibold text-slate-950">
                  {formatCompactCurrency(latestResult.netProfit)}
                </p>
              </div>
              <div className="rounded-[1.15rem] border border-slate-200/70 bg-slate-50/80 px-4 py-3">
                <p className="text-xs text-slate-500">{zh ? "市场占有率" : "Market share"}</p>
                <p className="mt-1 text-lg font-semibold text-slate-950">
                  {formatPercent(latestResult.overallMarketShare)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
