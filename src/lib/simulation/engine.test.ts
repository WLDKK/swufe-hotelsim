import { ClassStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { DEFAULT_SIM_PARAMETERS } from "@/lib/constants";
import { runBalanceTest } from "@/lib/simulation/balance-test";
import { buildRecommendedRoundEnvironment } from "@/lib/simulation/environment";
import {
  createClassConfig,
  createDecision,
  createHotelState,
  createRound,
  createTeam,
} from "@/lib/simulation/fixtures";
import {
  buildDefaultRoundScenario,
  getNextClassStatus,
  resolveSimulationParameters,
  runRoundSimulation,
} from "@/lib/simulation/engine";
import { buildSegmentDemandMap } from "@/lib/simulation/formulas";

type ExplanationLog = {
  operations: {
    weatherUtilityPressure: number;
    serviceStress: number;
    turnoverLoadIndex: number;
    demandCompressionIndex: number;
  };
};

describe("simulation engine", () => {
  it("fills missing simulation parameters from the default configuration", () => {
    const resolved = resolveSimulationParameters(
      createClassConfig({
        simParameters: {
          totalMarketDemandBase: 5200,
          daysInMonth: 31,
        },
      })
    );

    expect(resolved.totalMarketDemandBase).toBe(5200);
    expect(resolved.daysInMonth).toBe(31);
    expect(resolved.totalRooms).toBe(DEFAULT_SIM_PARAMETERS.totalRooms);
  });

  it("produces ranked results and hotel-state patches for every team", () => {
    const output = runRoundSimulation({
      round: createRound(),
      classConfig: createClassConfig(),
      parameters: DEFAULT_SIM_PARAMETERS,
      teams: [
        {
          team: createTeam("team-a"),
          decision: createDecision("team-a", {
            priceBusinessTransient: 540,
            marketingTotal: 102,
          }),
          hotelState: createHotelState("team-a", {
            brandReputation: 63,
            guestSatisfaction: 82,
          }),
        },
        {
          team: createTeam("team-b"),
          decision: createDecision("team-b", {
            priceBusinessTransient: 590,
            marketingTotal: 88,
          }),
          hotelState: createHotelState("team-b", {
            brandReputation: 54,
            guestSatisfaction: 76,
          }),
        },
      ],
    });

    expect(output).toHaveLength(2);
    expect(output.every((item) => item.result.roundNumber === 1)).toBe(true);
    expect(output.every((item) => item.result.totalRevenue > 0)).toBe(true);
    expect(output.every((item) => item.hotelStatePatch.lastUpdatedRound === 1)).toBe(true);

    const rankOverall = output.map((item) => item.result.rankOverall).sort();
    const rankRevenue = output.map((item) => item.result.rankRevenue).sort();
    const rankProfit = output.map((item) => item.result.rankProfit).sort();

    expect(rankOverall).toEqual([1, 2]);
    expect(rankRevenue).toEqual([1, 2]);
    expect(rankProfit).toEqual([1, 2]);

    const marketShareTotal = output.reduce(
      (sum, item) => sum + item.result.overallMarketShare,
      0
    );
    expect(marketShareTotal).toBeCloseTo(1, 3);
  });

  it("treats maxRoomNightsPerMonth as a true monthly inventory cap", () => {
    const [result] = runRoundSimulation({
      round: createRound(),
      classConfig: createClassConfig({
        totalRooms: 500,
        simParameters: {
          ...DEFAULT_SIM_PARAMETERS,
          totalRooms: 500,
          daysInMonth: 30,
          maxRoomNightsPerMonth: 2400,
        },
      }),
      parameters: DEFAULT_SIM_PARAMETERS,
      teams: [
        {
          team: createTeam("team-cap"),
          decision: createDecision("team-cap"),
          hotelState: createHotelState("team-cap"),
        },
      ],
    });

    expect(result.result.totalRoomsAvailable).toBe(2400);
    expect(result.result.totalRoomsSold).toBeLessThanOrEqual(
      result.result.totalRoomsAvailable
    );
  });

  it("creates a future round scenario with season metadata and deadline", () => {
    const roundScenario = buildDefaultRoundScenario(2);

    expect(roundScenario.roundNumber).toBe(2);
    expect(roundScenario.seasonFactor).toBeGreaterThan(0);
    expect(roundScenario.eventDescription).toContain("环境摘要");
    expect(roundScenario.deadline).toBeInstanceOf(Date);
  });

  it("marks the class as completed when the final round has been processed", () => {
    expect(
      getNextClassStatus({
        currentRound: 12,
        maxRounds: 12,
        status: ClassStatus.IN_PROGRESS,
      })
    ).toEqual({
      nextRoundNumber: 12,
      classStatus: ClassStatus.COMPLETED,
    });
  });

  it("runs the default balance test without critical warnings", () => {
    const report = runBalanceTest({
      scenarioCount: 8,
      teamCount: 4,
    });

    expect(report.summary.averageMarketShareDrift).toBeLessThan(0.02);
    expect(report.passed).toBe(true);
  });

  it("applies risk penalties to financially inconsistent strategies", () => {
    const [result] = runRoundSimulation({
      round: createRound(),
      classConfig: createClassConfig(),
      parameters: DEFAULT_SIM_PARAMETERS,
      teams: [
        {
          team: createTeam("team-risk"),
          decision: createDecision("team-risk", {
            marketingTotal: 120,
            mktBudgetBusinessTransient: 10,
            mktBudgetBusinessGroup: 10,
            mktBudgetLeisureTransient: 10,
            mktBudgetLeisureGroup: 10,
            mktBudgetGovernment: 10,
            mktBudgetOnlineOTA: 10,
            mktBudgetAirlineCrew: 10,
            mktBudgetLongStay: 10,
            channelDirect: 10,
            channelOTA: 55,
            channelTravelAgent: 20,
            channelCorporate: 20,
            channelGDS: 20,
            newLoanAmount: 2200,
            loanRepayment: 0,
            taxStrategy: "INCENTIVE_FOCUS",
          }),
          hotelState: createHotelState("team-risk", {
            cashBalance: 2_000_000,
            totalDebt: 500_000_000,
            guestSatisfaction: 68,
          }),
        },
      ],
    });

    expect(result.result.penaltyScore).toBeGreaterThan(0);
    expect(result.result.finalScore).toBeLessThan(result.result.systemScore);
  });

  it("displaces lower-yield segments first when inventory is compressed", () => {
    const [result] = runRoundSimulation({
      round: createRound({
        roundNumber: 7,
        seasonFactor: 1.12,
        economyFactor: 1.05,
        eventFactor: 1.08,
      }),
      classConfig: createClassConfig({
        totalRooms: 36,
        simParameters: {
          ...DEFAULT_SIM_PARAMETERS,
          totalRooms: 36,
          daysInMonth: 30,
          maxRoomNightsPerMonth: 1080,
        },
      }),
      parameters: DEFAULT_SIM_PARAMETERS,
      teams: [
        {
          team: createTeam("team-yield"),
          decision: createDecision("team-yield", {
            priceBusinessTransient: 790,
            priceBusinessGroup: 680,
            priceLeisureTransient: 530,
            priceLeisureGroup: 420,
            priceGovernment: 340,
            priceOnlineOTA: 260,
            priceAirlineCrew: 240,
            priceLongStay: 250,
            channelDirect: 34,
            channelOTA: 14,
            channelTravelAgent: 10,
            channelCorporate: 28,
            channelGDS: 14,
          }),
          hotelState: createHotelState("team-yield", {
            brandReputation: 78,
            technologyLevel: 84,
          }),
        },
      ],
    });

    const segmentResults = result.result.segmentResults as unknown as Array<{
      segmentId: string;
      demandAvailable: number;
      roomsSold: number;
    }>;
    const premiumTier = segmentResults
      .filter((segment) =>
        ["business_transient", "business_group", "leisure_transient"].includes(
          segment.segmentId
        )
      )
      .reduce(
        (sum, segment) => ({
          demandAvailable: sum.demandAvailable + segment.demandAvailable,
          roomsSold: sum.roomsSold + segment.roomsSold,
        }),
        { demandAvailable: 0, roomsSold: 0 }
      );
    const displacedTier = segmentResults
      .filter((segment) =>
        ["online_ota", "airline_crew", "long_stay"].includes(segment.segmentId)
      )
      .reduce(
        (sum, segment) => ({
          demandAvailable: sum.demandAvailable + segment.demandAvailable,
          roomsSold: sum.roomsSold + segment.roomsSold,
        }),
        { demandAvailable: 0, roomsSold: 0 }
      );
    const explanation = result.result.explanationLog as ExplanationLog;

    expect(
      premiumTier.roomsSold / Math.max(premiumTier.demandAvailable, 1)
    ).toBeGreaterThan(
      displacedTier.roomsSold / Math.max(displacedTier.demandAvailable, 1)
    );
    expect(explanation.operations.demandCompressionIndex).toBeGreaterThan(1);
  });

  it("reallocates segment demand toward business groups during expo rounds", () => {
    const teamFixture = [
      {
        team: createTeam("team-a"),
        decision: createDecision("team-a"),
        hotelState: createHotelState("team-a"),
      },
      {
        team: createTeam("team-b"),
        decision: createDecision("team-b"),
        hotelState: createHotelState("team-b"),
      },
    ];
    const expoEnvironment = buildRecommendedRoundEnvironment({
      roundNumber: 4,
      economyId: "growing",
      weatherId: "stable_clear",
      eventId: "expo",
    });
    const holidayEnvironment = buildRecommendedRoundEnvironment({
      roundNumber: 4,
      economyId: "growing",
      weatherId: "stable_clear",
      eventId: "holiday_peak",
    });
    const expoDemand = buildSegmentDemandMap(
      {
        round: createRound({
          roundNumber: 4,
          economyFactor: expoEnvironment.economyFactor,
          eventFactor: expoEnvironment.eventFactor,
          eventDescription: expoEnvironment.eventDescription,
        }),
        teams: teamFixture,
      },
      DEFAULT_SIM_PARAMETERS
    );
    const holidayDemand = buildSegmentDemandMap(
      {
        round: createRound({
          roundNumber: 4,
          economyFactor: holidayEnvironment.economyFactor,
          eventFactor: holidayEnvironment.eventFactor,
          eventDescription: holidayEnvironment.eventDescription,
        }),
        teams: teamFixture,
      },
      DEFAULT_SIM_PARAMETERS
    );

    const expoBusinessGroup =
      expoDemand.find((segment) => segment.segment.id === "business_group")?.totalDemand ?? 0;
    const holidayBusinessGroup =
      holidayDemand.find((segment) => segment.segment.id === "business_group")?.totalDemand ?? 0;
    const expoLeisure =
      expoDemand.find((segment) => segment.segment.id === "leisure_transient")?.totalDemand ?? 0;
    const holidayLeisure =
      holidayDemand.find((segment) => segment.segment.id === "leisure_transient")?.totalDemand ?? 0;

    expect(expoBusinessGroup).toBeGreaterThan(holidayBusinessGroup);
    expect(holidayLeisure).toBeGreaterThan(expoLeisure);
  });

  it("surfaces weather and staffing pressure in the explanation log", () => {
    const stableEnvironment = buildRecommendedRoundEnvironment({
      roundNumber: 7,
      economyId: "steady",
      weatherId: "stable_clear",
      eventId: "none",
    });
    const stressEnvironment = buildRecommendedRoundEnvironment({
      roundNumber: 7,
      economyId: "steady",
      weatherId: "heatwave",
      eventId: "none",
    });
    const [stableResult] = runRoundSimulation({
      round: createRound({
        roundNumber: 7,
        seasonFactor: stableEnvironment.seasonFactor,
        economyFactor: stableEnvironment.economyFactor,
        eventFactor: stableEnvironment.eventFactor,
        eventDescription: stableEnvironment.eventDescription,
      }),
      classConfig: createClassConfig(),
      parameters: DEFAULT_SIM_PARAMETERS,
      teams: [
        {
          team: createTeam("stable"),
          decision: createDecision("stable", {
            opexFrontDesk: 18,
            opexHousekeeping: 28,
            opexStaffTraining: 12,
            opexStaffWelfare: 10,
          }),
          hotelState: createHotelState("stable", {
            technologyLevel: 80,
            staffTrainingLevel: 76,
            staffMorale: 78,
          }),
        },
      ],
    });
    const [stressResult] = runRoundSimulation({
      round: createRound({
        roundNumber: 7,
        seasonFactor: stressEnvironment.seasonFactor,
        economyFactor: stressEnvironment.economyFactor,
        eventFactor: stressEnvironment.eventFactor,
        eventDescription: stressEnvironment.eventDescription,
      }),
      classConfig: createClassConfig(),
      parameters: DEFAULT_SIM_PARAMETERS,
      teams: [
        {
          team: createTeam("stress"),
          decision: createDecision("stress", {
            opexFrontDesk: 10,
            opexHousekeeping: 14,
            opexStaffTraining: 4,
            opexStaffWelfare: 3,
          }),
          hotelState: createHotelState("stress", {
            technologyLevel: 62,
            staffTrainingLevel: 54,
            staffMorale: 56,
          }),
        },
      ],
    });

    const stableExplanation = stableResult.result.explanationLog as ExplanationLog;
    const stressExplanation = stressResult.result.explanationLog as ExplanationLog;

    expect(stressExplanation.operations.weatherUtilityPressure).toBeGreaterThan(
      stableExplanation.operations.weatherUtilityPressure
    );
    expect(stressExplanation.operations.serviceStress).toBeGreaterThanOrEqual(0);
    expect(stableExplanation.operations.turnoverLoadIndex).toBeGreaterThan(0);
    expect(stressExplanation.operations.demandCompressionIndex).toBeGreaterThan(0);
  });
});
