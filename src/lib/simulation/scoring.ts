import { clamp, roundTo } from "@/lib/simulation/formulas";
import {
  DEFAULT_SCORING_SNAPSHOT,
  normalizeScoringSnapshot,
  type SimulationScoringSnapshot,
} from "@/lib/simulation/rulesets";

export type SystemMetricScoreBreakdown = {
  label: string;
  rawValue: number;
  targetValue: number;
  normalizedScore: number;
  weight: number;
  contribution: number;
};

export type SystemScoreBreakdown = {
  version: string;
  totalScore: number;
  metrics: {
    revenue: SystemMetricScoreBreakdown;
    profit: SystemMetricScoreBreakdown;
    occupancy: SystemMetricScoreBreakdown;
    guest: SystemMetricScoreBreakdown;
    esg: SystemMetricScoreBreakdown;
  };
};

function normalizeAgainstTarget(rawValue: number, targetValue: number) {
  if (!Number.isFinite(rawValue) || !Number.isFinite(targetValue) || targetValue <= 0) {
    return 0;
  }

  return clamp((rawValue / targetValue) * 100, 0, 130);
}

export function calculateSystemScoreBreakdown(input: {
  totalRevenue: number;
  netProfit: number;
  occupancyRate: number;
  guestSatisfactionEnd: number;
  esgScoreEnd: number;
  scoringSnapshot?: unknown;
}) {
  const scoringSnapshot = normalizeScoringSnapshot(input.scoringSnapshot);

  const metrics = {
    revenue: buildMetricBreakdown({
      label: "Revenue",
      rawValue: input.totalRevenue,
      targetValue: scoringSnapshot.metricTargets.revenue,
      weight: scoringSnapshot.metricWeights.revenue,
    }),
    profit: buildMetricBreakdown({
      label: "Profit",
      rawValue: input.netProfit,
      targetValue: scoringSnapshot.metricTargets.profit,
      weight: scoringSnapshot.metricWeights.profit,
    }),
    occupancy: buildMetricBreakdown({
      label: "Occupancy",
      rawValue: input.occupancyRate,
      targetValue: scoringSnapshot.metricTargets.occupancy,
      weight: scoringSnapshot.metricWeights.occupancy,
    }),
    guest: buildMetricBreakdown({
      label: "Guest satisfaction",
      rawValue: input.guestSatisfactionEnd,
      targetValue: scoringSnapshot.metricTargets.guest,
      weight: scoringSnapshot.metricWeights.guest,
    }),
    esg: buildMetricBreakdown({
      label: "ESG",
      rawValue: input.esgScoreEnd,
      targetValue: scoringSnapshot.metricTargets.esg,
      weight: scoringSnapshot.metricWeights.esg,
    }),
  };

  const totalScore = roundTo(
    Object.values(metrics).reduce((sum, metric) => sum + metric.contribution, 0),
    2
  );

  return {
    version: scoringSnapshot.version,
    totalScore,
    metrics,
  } satisfies SystemScoreBreakdown;
}

function buildMetricBreakdown(input: {
  label: string;
  rawValue: number;
  targetValue: number;
  weight: number;
}) {
  const normalizedScore = roundTo(
    normalizeAgainstTarget(input.rawValue, input.targetValue),
    2
  );

  return {
    label: input.label,
    rawValue: roundTo(input.rawValue, 4),
    targetValue: roundTo(input.targetValue, 4),
    normalizedScore,
    weight: roundTo(input.weight, 4),
    contribution: roundTo(normalizedScore * input.weight, 2),
  } satisfies SystemMetricScoreBreakdown;
}

export function calculateFinalScore(input: {
  systemScore: number | null | undefined;
  judgeScoreAverage: number | null | undefined;
  penaltyScore?: number | null | undefined;
  scoringSnapshot?: unknown;
}) {
  const scoringSnapshot = normalizeScoringSnapshot(input.scoringSnapshot);
  const systemScore = input.systemScore ?? 0;
  const judgeScoreAverage = input.judgeScoreAverage ?? systemScore;
  const penaltyScore = input.penaltyScore ?? 0;

  return roundTo(
    systemScore * scoringSnapshot.systemWeight +
      judgeScoreAverage * scoringSnapshot.judgeWeight -
      penaltyScore * scoringSnapshot.penaltyWeight,
    2
  );
}

export function getDefaultScoringSnapshot() {
  return DEFAULT_SCORING_SNAPSHOT satisfies SimulationScoringSnapshot;
}
