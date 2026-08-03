import { DEFAULT_SIM_PARAMETERS, type SimParameters } from "@/lib/constants";
import { runRoundSimulation } from "@/lib/simulation/engine";
import { createSimulationFixture } from "@/lib/simulation/fixtures";

export type BalanceTestWarning = {
  severity: "critical" | "warning";
  code: string;
  message: string;
};

export type BalanceTestSummary = {
  scenarioCount: number;
  teamCount: number;
  averageOccupancyRate: number;
  averageAdr: number;
  averageAncillaryRevenueRatio: number;
  averageGopMargin: number;
  averageNetProfitMargin: number;
  averagePenaltyScore: number;
  averageRevenueSpreadRatio: number;
  averageProfitSpreadRatio: number;
  negativeProfitShare: number;
  negativeCashShare: number;
  averageMarketShareDrift: number;
  topRankConcentration: number;
};

export type BalanceTestReport = {
  passed: boolean;
  parameters: SimParameters;
  summary: BalanceTestSummary;
  warnings: BalanceTestWarning[];
};

type BalanceThresholds = {
  minAverageOccupancyRate: number;
  maxAverageOccupancyRate: number;
  minAverageAncillaryRevenueRatio: number;
  maxAverageAncillaryRevenueRatio: number;
  minAverageGopMargin: number;
  maxAverageGopMargin: number;
  minAverageRevenueSpreadRatio: number;
  maxAverageRevenueSpreadRatio: number;
  minNegativeProfitShare: number;
  maxNegativeCashShare: number;
  maxAverageMarketShareDrift: number;
  maxTopRankConcentration: number;
};

type BalanceTestOptions = {
  scenarioCount?: number;
  teamCount?: number;
  parameterOverrides?: Partial<SimParameters>;
  thresholds?: Partial<BalanceThresholds>;
};

const DEFAULT_THRESHOLDS: BalanceThresholds = {
  minAverageOccupancyRate: 0.5,
  maxAverageOccupancyRate: 0.9,
  minAverageAncillaryRevenueRatio: 0.22,
  maxAverageAncillaryRevenueRatio: 0.7,
  minAverageGopMargin: 0.08,
  maxAverageGopMargin: 0.5,
  minAverageRevenueSpreadRatio: 0.04,
  maxAverageRevenueSpreadRatio: 0.6,
  minNegativeProfitShare: 0.02,
  maxNegativeCashShare: 0.6,
  maxAverageMarketShareDrift: 0.02,
  maxTopRankConcentration: 0.9,
};

function roundTo(value: number, decimals = 4) {
  return Number(value.toFixed(decimals));
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildScenarioInput(
  scenarioIndex: number,
  teamCount: number,
  parameters: SimParameters
) {
  const advantagedTeamIndex = scenarioIndex % Math.max(teamCount, 1);
  const stressedTeamIndex = (scenarioIndex + 1) % Math.max(teamCount, 1);

  return createSimulationFixture({
    teamCount,
    classOverrides: {
      simParameters: parameters,
    },
    roundOverrides: {
      roundNumber: (scenarioIndex % 12) + 1,
      seasonFactor: 0.9 + (scenarioIndex % 4) * 0.08,
      economyFactor: 0.96 + (scenarioIndex % 3) * 0.03,
      eventFactor: 0.94 + (scenarioIndex % 5) * 0.025,
    },
    decisionMutator: (teamIndex) => {
      const teamBias = teamIndex - (teamCount - 1) / 2;
      const scenarioBias = (scenarioIndex % 5) - 2;
      const advantageBoost = teamIndex === advantagedTeamIndex ? 1 : 0;
      const stressPenalty = teamIndex === stressedTeamIndex ? 1 : 0;

      return {
        priceBusinessTransient:
          560 + teamBias * 22 + scenarioBias * 6 - advantageBoost * 14 + stressPenalty * 26,
        priceBusinessGroup:
          500 + teamBias * 18 + scenarioBias * 5 - advantageBoost * 10 + stressPenalty * 22,
        priceLeisureTransient:
          455 + teamBias * 14 - scenarioBias * 4 - advantageBoost * 8 + stressPenalty * 20,
        priceLeisureGroup:
          410 + teamBias * 10 - scenarioBias * 3 - advantageBoost * 7 + stressPenalty * 18,
        priceOnlineOTA:
          425 + teamBias * 11 - scenarioBias * 4 - advantageBoost * 9 + stressPenalty * 24,
        marketingTotal:
          86 + (scenarioIndex % 4) * 6 + teamIndex * 4 + advantageBoost * 10 + stressPenalty * 28,
        mktBudgetBusinessTransient:
          12 + ((teamIndex + scenarioIndex) % 3) * 2 + advantageBoost * 2,
        mktBudgetLeisureTransient:
          13 + ((teamIndex + scenarioIndex) % 4) * 2 + advantageBoost * 2 - stressPenalty * 3,
        channelDirect: 24 + teamIndex * 2 - stressPenalty * 8,
        channelOTA: 30 - teamIndex + stressPenalty * 12,
        channelCorporate: 18 + teamIndex - stressPenalty * 8,
        opexRoomsMaintenance: 28 + teamIndex,
        opexFrontDesk: 13 + (scenarioIndex % 3) + stressPenalty * 3,
        opexHousekeeping: 20 + teamIndex + stressPenalty * 4,
        opexUtilities: 18 + stressPenalty * 7,
        opexIT: 7 + (scenarioIndex % 2),
        capexRenovation: 5 + ((scenarioIndex + teamIndex) % 4) + stressPenalty * 3,
        capexTechnology: 4 + ((scenarioIndex + teamIndex) % 3) + stressPenalty * 2,
        capexESGGreen: 3 + ((scenarioIndex + teamIndex) % 3) + advantageBoost,
        esgEnergyInvestment: 34 + teamIndex * 3 + advantageBoost * 4,
        esgWasteManagement: 32 + (scenarioIndex % 4) * 2,
        newLoanAmount: stressPenalty * 60,
        taxStrategy: stressPenalty ? "INCENTIVE_FOCUS" : "STANDARD",
      };
    },
    hotelStateMutator: (teamIndex) => {
      const scenarioBias = (scenarioIndex % 4) - 1.5;
      const advantageBoost = teamIndex === advantagedTeamIndex ? 1 : 0;
      const stressPenalty = teamIndex === stressedTeamIndex ? 1 : 0;

      return {
        brandReputation:
          52 + teamIndex * 4 + scenarioBias * 2 + advantageBoost * 6 - stressPenalty * 8,
        guestSatisfaction:
          75 + teamIndex * 2 + scenarioBias * 2 + advantageBoost * 4 - stressPenalty * 10,
        esgScore: 55 + teamIndex * 3 + advantageBoost * 3,
        onlineRating: 4.0 + teamIndex * 0.06 + advantageBoost * 0.08 - stressPenalty * 0.22,
        technologyLevel: 68 + teamIndex * 3 + advantageBoost * 4 - stressPenalty * 6,
        propertyCondition: 82 + teamIndex * 2 + advantageBoost * 3 - stressPenalty * 7,
      };
    },
  });
}

export function runBalanceTest(options: BalanceTestOptions = {}): BalanceTestReport {
  const scenarioCount = options.scenarioCount ?? 12;
  const teamCount = options.teamCount ?? 4;
  const parameters = {
    ...DEFAULT_SIM_PARAMETERS,
    ...(options.parameterOverrides ?? {}),
  };
  const thresholds = {
    ...DEFAULT_THRESHOLDS,
    ...(options.thresholds ?? {}),
  };

  const occupancyRates: number[] = [];
  const adrs: number[] = [];
  const ancillaryRevenueRatios: number[] = [];
  const gopMargins: number[] = [];
  const netProfitMargins: number[] = [];
  const penaltyScores: number[] = [];
  const revenueSpreadRatios: number[] = [];
  const profitSpreadRatios: number[] = [];
  let negativeProfitCount = 0;
  let negativeCashCount = 0;
  const marketShareDrift: number[] = [];
  const firstPlaceCounts = new Map<string, number>();

  for (let scenarioIndex = 0; scenarioIndex < scenarioCount; scenarioIndex += 1) {
    const input = buildScenarioInput(scenarioIndex, teamCount, parameters);
    const output = runRoundSimulation(input);
    const revenues = output.map((item) => item.result.totalRevenue);
    const profits = output.map((item) => item.result.netProfit);
    const scenarioAverageRevenue = average(revenues);
    const scenarioAverageProfit = average(profits.map((value) => Math.abs(value)));
    const revenueSpreadRatio =
      (Math.max(...revenues) - Math.min(...revenues)) /
      Math.max(scenarioAverageRevenue, 1);
    const profitSpreadRatio =
      (Math.max(...profits) - Math.min(...profits)) /
      Math.max(scenarioAverageProfit, 1);
    const marketShareTotal = output.reduce(
      (sum, item) => sum + item.result.overallMarketShare,
      0
    );
    const leader =
      [...output].sort((left, right) => left.result.rankOverall - right.result.rankOverall)[0]
        ?.teamId ?? null;

    occupancyRates.push(...output.map((item) => item.result.occupancyRate));
    adrs.push(...output.map((item) => item.result.adr));
    ancillaryRevenueRatios.push(
      ...output.map((item) =>
        (item.result.fbRevenue + item.result.otherRevenue) /
        Math.max(item.result.roomRevenue, 1)
      )
    );
    gopMargins.push(
      ...output.map((item) =>
        item.result.grossOperatingProfit / Math.max(item.result.totalRevenue, 1)
      )
    );
    netProfitMargins.push(
      ...output.map((item) =>
        item.result.netProfit / Math.max(item.result.totalRevenue, 1)
      )
    );
    penaltyScores.push(...output.map((item) => item.result.penaltyScore));
    revenueSpreadRatios.push(revenueSpreadRatio);
    profitSpreadRatios.push(profitSpreadRatio);
    negativeProfitCount += output.filter((item) => item.result.netProfit < 0).length;
    negativeCashCount += output.filter((item) => item.result.cashBalanceEnd < 0).length;
    marketShareDrift.push(Math.abs(1 - marketShareTotal));

    if (leader) {
      firstPlaceCounts.set(leader, (firstPlaceCounts.get(leader) ?? 0) + 1);
    }
  }

  const teamObservations = scenarioCount * teamCount;
  const summary: BalanceTestSummary = {
    scenarioCount,
    teamCount,
    averageOccupancyRate: roundTo(average(occupancyRates)),
    averageAdr: roundTo(average(adrs), 2),
    averageAncillaryRevenueRatio: roundTo(average(ancillaryRevenueRatios)),
    averageGopMargin: roundTo(average(gopMargins)),
    averageNetProfitMargin: roundTo(average(netProfitMargins)),
    averagePenaltyScore: roundTo(average(penaltyScores), 2),
    averageRevenueSpreadRatio: roundTo(average(revenueSpreadRatios)),
    averageProfitSpreadRatio: roundTo(average(profitSpreadRatios)),
    negativeProfitShare: roundTo(negativeProfitCount / Math.max(teamObservations, 1)),
    negativeCashShare: roundTo(negativeCashCount / Math.max(teamObservations, 1)),
    averageMarketShareDrift: roundTo(average(marketShareDrift)),
    topRankConcentration: roundTo(
      Math.max(...Array.from(firstPlaceCounts.values()), 0) / Math.max(scenarioCount, 1)
    ),
  };

  const warnings: BalanceTestWarning[] = [];

  if (summary.averageOccupancyRate < thresholds.minAverageOccupancyRate) {
    warnings.push({
      severity: "critical",
      code: "occupancy-too-low",
      message: `Average occupancy ${summary.averageOccupancyRate} is below the lower bound ${thresholds.minAverageOccupancyRate}.`,
    });
  }

  if (summary.averageOccupancyRate > thresholds.maxAverageOccupancyRate) {
    warnings.push({
      severity: "critical",
      code: "occupancy-too-high",
      message: `Average occupancy ${summary.averageOccupancyRate} is above the upper bound ${thresholds.maxAverageOccupancyRate}.`,
    });
  }

  if (
    summary.averageAncillaryRevenueRatio < thresholds.minAverageAncillaryRevenueRatio
  ) {
    warnings.push({
      severity: "warning",
      code: "ancillary-ratio-too-low",
      message: `Average ancillary revenue ratio ${summary.averageAncillaryRevenueRatio} is below the lower bound ${thresholds.minAverageAncillaryRevenueRatio}.`,
    });
  }

  if (
    summary.averageAncillaryRevenueRatio > thresholds.maxAverageAncillaryRevenueRatio
  ) {
    warnings.push({
      severity: "warning",
      code: "ancillary-ratio-too-high",
      message: `Average ancillary revenue ratio ${summary.averageAncillaryRevenueRatio} is above the upper bound ${thresholds.maxAverageAncillaryRevenueRatio}.`,
    });
  }

  if (summary.averageGopMargin < thresholds.minAverageGopMargin) {
    warnings.push({
      severity: "warning",
      code: "gop-margin-too-low",
      message: `Average GOP margin ${summary.averageGopMargin} is below the lower bound ${thresholds.minAverageGopMargin}.`,
    });
  }

  if (summary.averageGopMargin > thresholds.maxAverageGopMargin) {
    warnings.push({
      severity: "warning",
      code: "gop-margin-too-high",
      message: `Average GOP margin ${summary.averageGopMargin} is above the upper bound ${thresholds.maxAverageGopMargin}.`,
    });
  }

  if (summary.averageRevenueSpreadRatio < thresholds.minAverageRevenueSpreadRatio) {
    warnings.push({
      severity: "warning",
      code: "revenue-spread-too-flat",
      message: `Average revenue spread ratio ${summary.averageRevenueSpreadRatio} is low; strategy differences may not be visible enough.`,
    });
  }

  if (summary.averageRevenueSpreadRatio > thresholds.maxAverageRevenueSpreadRatio) {
    warnings.push({
      severity: "warning",
      code: "revenue-spread-too-wide",
      message: `Average revenue spread ratio ${summary.averageRevenueSpreadRatio} is high; outcomes may be too polarized.`,
    });
  }

  if (summary.negativeProfitShare < thresholds.minNegativeProfitShare) {
    warnings.push({
      severity: "warning",
      code: "negative-profit-too-rare",
      message: `Negative profit share ${summary.negativeProfitShare} is very low; the engine may be too forgiving for weaker strategies.`,
    });
  }

  if (summary.negativeCashShare > thresholds.maxNegativeCashShare) {
    warnings.push({
      severity: "warning",
      code: "negative-cash-too-common",
      message: `Negative cash share ${summary.negativeCashShare} is high; the default parameters may be too strict.`,
    });
  }

  if (summary.averageMarketShareDrift > thresholds.maxAverageMarketShareDrift) {
    warnings.push({
      severity: "critical",
      code: "market-share-normalization-drift",
      message: `Market-share normalization drift ${summary.averageMarketShareDrift} exceeds the threshold and indicates a conservation bug.`,
    });
  }

  if (summary.topRankConcentration > thresholds.maxTopRankConcentration) {
    warnings.push({
      severity: "warning",
      code: "rank-concentration-too-high",
      message: `Top-rank concentration ${summary.topRankConcentration} is high; the same team wins too consistently.`,
    });
  }

  return {
    passed: warnings.every((warning) => warning.severity !== "critical"),
    parameters,
    summary,
    warnings,
  };
}
