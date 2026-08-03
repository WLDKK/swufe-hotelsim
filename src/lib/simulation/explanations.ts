import { roundTo } from "@/lib/simulation/formulas";
import type { SegmentResult } from "@/types";
import type { SystemScoreBreakdown } from "@/lib/simulation/scoring";

type ExplanationMetricKey = keyof SystemScoreBreakdown["metrics"];

function resolveMetricHighlights(metrics: SystemScoreBreakdown["metrics"]) {
  const ordered = Object.entries(metrics).sort(
    (left, right) => right[1].contribution - left[1].contribution
  ) as Array<[ExplanationMetricKey, SystemScoreBreakdown["metrics"][ExplanationMetricKey]]>;

  return {
    strongest: ordered[0],
    weakest: ordered[ordered.length - 1],
  };
}

function resolveSegmentHighlights(segmentResults: SegmentResult[]) {
  const sorted = [...segmentResults].sort((left, right) => right.revenue - left.revenue);

  return {
    strongest: sorted[0]
      ? {
          segmentId: sorted[0].segmentId,
          segmentName: sorted[0].segmentName,
          revenue: roundTo(sorted[0].revenue, 2),
          roomsSold: sorted[0].roomsSold,
        }
      : null,
    weakest: sorted[sorted.length - 1]
      ? {
          segmentId: sorted[sorted.length - 1].segmentId,
          segmentName: sorted[sorted.length - 1].segmentName,
          revenue: roundTo(sorted[sorted.length - 1].revenue, 2),
          roomsSold: sorted[sorted.length - 1].roomsSold,
        }
      : null,
  };
}

export function buildSimulationExplanationLog(input: {
  roundNumber: number;
  randomSeed: string | null;
  rulesetVersion: string | null;
  totalRevenue: number;
  roomRevenue: number;
  fbRevenue: number;
  otherRevenue: number;
  totalOpex: number;
  totalMarketing: number;
  totalCapex: number;
  depreciationExpense: number;
  interestExpense: number;
  taxExpense: number;
  netProfit: number;
  occupancyRate: number;
  adr: number;
  revpar: number;
  averagePrice: number;
  guestSatisfactionEnd: number;
  esgScoreEnd: number;
  brandReputationEnd: number;
  directMix: number;
  serviceCapacityScore: number;
  serviceStress: number;
  turnoverLoadIndex: number;
  demandCompressionIndex: number;
  laborOvertimeFactor: number;
  weatherUtilityPressure: number;
  propertyTaxExpense: number;
  vatExpense: number;
  incomeTaxExpense: number;
  channelAcquisitionCost: number;
  channelCostRate: number;
  ancillaryRevenueRatio: number;
  penaltyBreakdown: Record<string, number>;
  segmentResults: SegmentResult[];
  systemScoreBreakdown: SystemScoreBreakdown;
}) {
  const metricHighlights = resolveMetricHighlights(input.systemScoreBreakdown.metrics);
  const segmentHighlights = resolveSegmentHighlights(input.segmentResults);

  return {
    version: "simulation-explanation-v1",
    roundNumber: input.roundNumber,
    rulesetVersion: input.rulesetVersion,
    randomSeed: input.randomSeed,
    financials: {
      totalRevenue: roundTo(input.totalRevenue, 2),
      roomRevenue: roundTo(input.roomRevenue, 2),
      ancillaryRevenue: roundTo(input.fbRevenue + input.otherRevenue, 2),
      ancillaryRevenueRatio: roundTo(input.ancillaryRevenueRatio, 4),
      totalOpex: roundTo(input.totalOpex, 2),
      totalMarketing: roundTo(input.totalMarketing, 2),
      totalCapex: roundTo(input.totalCapex, 2),
      depreciationExpense: roundTo(input.depreciationExpense, 2),
      interestExpense: roundTo(input.interestExpense, 2),
      taxExpense: roundTo(input.taxExpense, 2),
      propertyTaxExpense: roundTo(input.propertyTaxExpense, 2),
      vatExpense: roundTo(input.vatExpense, 2),
      incomeTaxExpense: roundTo(input.incomeTaxExpense, 2),
      channelAcquisitionCost: roundTo(input.channelAcquisitionCost, 2),
      channelCostRate: roundTo(input.channelCostRate, 4),
      directMix: roundTo(input.directMix, 4),
      netProfit: roundTo(input.netProfit, 2),
    },
    operations: {
      occupancyRate: roundTo(input.occupancyRate, 4),
      adr: roundTo(input.adr, 2),
      revpar: roundTo(input.revpar, 2),
      averagePrice: roundTo(input.averagePrice, 2),
      guestSatisfactionEnd: roundTo(input.guestSatisfactionEnd, 2),
      esgScoreEnd: roundTo(input.esgScoreEnd, 2),
      brandReputationEnd: roundTo(input.brandReputationEnd, 2),
      serviceCapacityScore: roundTo(input.serviceCapacityScore, 4),
      serviceStress: roundTo(input.serviceStress, 4),
      turnoverLoadIndex: roundTo(input.turnoverLoadIndex, 4),
      demandCompressionIndex: roundTo(input.demandCompressionIndex, 4),
      laborOvertimeFactor: roundTo(input.laborOvertimeFactor, 4),
      weatherUtilityPressure: roundTo(input.weatherUtilityPressure, 4),
    },
    penalties: input.penaltyBreakdown,
    scoreHighlights: {
      strongestMetric: metricHighlights.strongest
        ? {
            key: metricHighlights.strongest[0],
            label: metricHighlights.strongest[1].label,
            contribution: metricHighlights.strongest[1].contribution,
          }
        : null,
      weakestMetric: metricHighlights.weakest
        ? {
            key: metricHighlights.weakest[0],
            label: metricHighlights.weakest[1].label,
            contribution: metricHighlights.weakest[1].contribution,
          }
        : null,
    },
    segmentHighlights,
  };
}
