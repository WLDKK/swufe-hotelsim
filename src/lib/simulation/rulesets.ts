import type { Class, Prisma, Ruleset } from "@prisma/client";
import { DEFAULT_SIM_PARAMETERS } from "@/lib/constants";
import { SIMULATION_FORMULA_MANIFEST } from "@/lib/simulation/formulas";

export const DEFAULT_RULESET_NAME = "HotelSim Temporary Stable Baseline";
export const DEFAULT_RULESET_VERSION = "v1.1";

export type SimulationScoringSnapshot = {
  version: string;
  systemWeight: number;
  judgeWeight: number;
  penaltyWeight: number;
  metricWeights: {
    revenue: number;
    profit: number;
    occupancy: number;
    guest: number;
    esg: number;
  };
  metricTargets: {
    revenue: number;
    profit: number;
    occupancy: number;
    guest: number;
    esg: number;
  };
};

export const DEFAULT_SCORING_SNAPSHOT: SimulationScoringSnapshot = {
  version: "temporary-stable-v1.1-calibrated",
  systemWeight: 0.75,
  judgeWeight: 0.25,
  penaltyWeight: 1,
  metricWeights: {
    revenue: 0.18,
    profit: 0.36,
    occupancy: 0.14,
    guest: 0.18,
    esg: 0.14,
  },
  metricTargets: {
    revenue: 6_800_000,
    profit: 950_000,
    occupancy: 0.74,
    guest: 84,
    esg: 72,
  },
};

export function buildDefaultRulesetConfig() {
  return {
    name: DEFAULT_RULESET_NAME,
    version: DEFAULT_RULESET_VERSION,
    description:
      "Competition-ready calibrated baseline ruleset preserved inside the repository so future formula swaps only replace leaf calculations.",
    formulaConfig: {
      formulaSetId: "hotelsim-temp-stable-baseline",
      formulaManifest: SIMULATION_FORMULA_MANIFEST,
      defaultParameters: DEFAULT_SIM_PARAMETERS,
    } satisfies Prisma.InputJsonObject,
    scoringConfig: DEFAULT_SCORING_SNAPSHOT satisfies Prisma.InputJsonObject,
    rankingConfig: {
      primaryMetric: "finalScore",
      secondaryMetrics: ["netProfit", "totalRevenue", "occupancyRate"],
    } satisfies Prisma.InputJsonObject,
  };
}

export function normalizeScoringSnapshot(
  scoringSnapshot: unknown
): SimulationScoringSnapshot {
  if (!scoringSnapshot || typeof scoringSnapshot !== "object") {
    return DEFAULT_SCORING_SNAPSHOT;
  }

  const candidate = scoringSnapshot as Partial<SimulationScoringSnapshot>;

  return {
    version:
      typeof candidate.version === "string" && candidate.version.length > 0
        ? candidate.version
        : DEFAULT_SCORING_SNAPSHOT.version,
    systemWeight:
      typeof candidate.systemWeight === "number"
        ? candidate.systemWeight
        : DEFAULT_SCORING_SNAPSHOT.systemWeight,
    judgeWeight:
      typeof candidate.judgeWeight === "number"
        ? candidate.judgeWeight
        : DEFAULT_SCORING_SNAPSHOT.judgeWeight,
    penaltyWeight:
      typeof candidate.penaltyWeight === "number"
        ? candidate.penaltyWeight
        : DEFAULT_SCORING_SNAPSHOT.penaltyWeight,
    metricWeights: {
      ...DEFAULT_SCORING_SNAPSHOT.metricWeights,
      ...(candidate.metricWeights ?? {}),
    },
    metricTargets: {
      ...DEFAULT_SCORING_SNAPSHOT.metricTargets,
      ...(candidate.metricTargets ?? {}),
    },
  };
}

export function buildRoundRandomSeed(input: {
  classId: string;
  roundNumber: number;
  rulesetVersion: string;
}) {
  return `round:${input.classId}:${input.roundNumber}:${input.rulesetVersion}`;
}

export function buildRoundRuntimeSnapshot(input: {
  classConfig: Pick<Class, "id" | "simParameters">;
  roundNumber: number;
  ruleset: Pick<Ruleset, "id" | "name" | "version" | "scoringConfig"> | null;
}) {
  const defaultRuleset = buildDefaultRulesetConfig();
  const rulesetVersion = input.ruleset?.version ?? defaultRuleset.version;
  const rulesetName = input.ruleset?.name ?? defaultRuleset.name;
  const parameterSnapshot =
    input.classConfig.simParameters && typeof input.classConfig.simParameters === "object"
      ? (input.classConfig.simParameters as Prisma.InputJsonObject)
      : ({ ...DEFAULT_SIM_PARAMETERS } satisfies Prisma.InputJsonObject);
  const scoringSnapshot = normalizeScoringSnapshot(
    input.ruleset?.scoringConfig ?? defaultRuleset.scoringConfig
  );

  return {
    rulesetId: input.ruleset?.id ?? null,
    rulesetVersion,
    rulesetName,
    parameterSnapshot,
    scoringSnapshot: scoringSnapshot as Prisma.InputJsonObject,
    randomSeed: buildRoundRandomSeed({
      classId: input.classConfig.id,
      roundNumber: input.roundNumber,
      rulesetVersion,
    }),
  };
}
