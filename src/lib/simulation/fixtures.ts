import { ClassStatus, RoundStatus } from "@prisma/client";
import { DEFAULT_SIM_PARAMETERS } from "@/lib/constants";
import type { SimulationInput } from "@/types";

type SimulationFixtureOptions = {
  teamCount?: number;
  classOverrides?: Partial<SimulationInput["classConfig"]>;
  roundOverrides?: Partial<SimulationInput["round"]>;
  decisionMutator?: (
    teamIndex: number
  ) => Partial<SimulationInput["teams"][number]["decision"]>;
  hotelStateMutator?: (
    teamIndex: number
  ) => Partial<SimulationInput["teams"][number]["hotelState"]>;
  teamMutator?: (
    teamIndex: number
  ) => Partial<SimulationInput["teams"][number]["team"]>;
};

export function createClassConfig(
  overrides: Partial<SimulationInput["classConfig"]> = {}
): SimulationInput["classConfig"] {
  return {
    id: "class-1",
    semesterId: "semester-1",
    name: "Hotel Simulation Class A",
    joinCode: "JOIN-001",
    maxTeams: 4,
    minTeamSize: 3,
    maxTeamSize: 4,
    totalRooms: 500,
    currentRound: 1,
    maxRounds: 12,
    status: ClassStatus.IN_PROGRESS,
    simParameters: DEFAULT_SIM_PARAMETERS,
    createdAt: new Date("2026-03-01T00:00:00.000Z"),
    updatedAt: new Date("2026-03-01T00:00:00.000Z"),
    ...overrides,
  } as SimulationInput["classConfig"];
}

export function createRound(
  overrides: Partial<SimulationInput["round"]> = {}
): SimulationInput["round"] {
  return {
    id: "round-1",
    classId: "class-1",
    roundNumber: 1,
    status: RoundStatus.PENDING,
    seasonFactor: 1,
    economyFactor: 1,
    eventFactor: 1,
    eventDescription: "Spring operating cycle",
    deadline: new Date("2026-03-15T00:00:00.000Z"),
    processedAt: null,
    createdAt: new Date("2026-03-01T00:00:00.000Z"),
    updatedAt: new Date("2026-03-01T00:00:00.000Z"),
    ...overrides,
  } as SimulationInput["round"];
}

export function createHotelState(
  teamId: string,
  overrides: Partial<SimulationInput["teams"][number]["hotelState"]> = {}
) {
  return {
    id: `hotel-state-${teamId}`,
    teamId,
    cashBalance: 50_000_000,
    totalDebt: 200_000_000,
    debtInterestRate: 0.045,
    accumulatedProfit: 0,
    propertyCondition: 86,
    furnitureCondition: 88,
    technologyLevel: 74,
    brandReputation: 58,
    onlineRating: 4.2,
    guestSatisfaction: 79,
    esgScore: 63,
    energyEfficiency: 66,
    staffMorale: 72,
    staffTrainingLevel: 69,
    lastUpdatedRound: 0,
    createdAt: new Date("2026-03-01T00:00:00.000Z"),
    updatedAt: new Date("2026-03-01T00:00:00.000Z"),
    ...overrides,
  } as SimulationInput["teams"][number]["hotelState"];
}

export function createDecision(
  teamId: string,
  overrides: Partial<SimulationInput["teams"][number]["decision"]> = {}
) {
  return {
    id: `decision-${teamId}`,
    teamId,
    roundId: "round-1",
    status: "SUBMITTED",
    submittedAt: new Date("2026-03-12T00:00:00.000Z"),
    submittedBy: "student-1",
    priceBusinessTransient: 560,
    priceBusinessGroup: 500,
    priceLeisureTransient: 460,
    priceLeisureGroup: 410,
    priceGovernment: 360,
    priceOnlineOTA: 430,
    priceAirlineCrew: 290,
    priceLongStay: 320,
    marketingTotal: 96,
    mktBudgetBusinessTransient: 14,
    mktBudgetBusinessGroup: 12,
    mktBudgetLeisureTransient: 15,
    mktBudgetLeisureGroup: 11,
    mktBudgetGovernment: 10,
    mktBudgetOnlineOTA: 13,
    mktBudgetAirlineCrew: 8,
    mktBudgetLongStay: 13,
    channelDirect: 28,
    channelOTA: 26,
    channelTravelAgent: 12,
    channelCorporate: 24,
    channelGDS: 10,
    opexRoomsMaintenance: 30,
    opexFoodBeverage: 26,
    opexFrontDesk: 14,
    opexHousekeeping: 24,
    opexUtilities: 18,
    opexStaffTraining: 9,
    opexStaffWelfare: 8,
    opexSecurity: 6,
    opexIT: 8,
    capexRenovation: 8,
    capexFurniture: 5,
    capexTechnology: 6,
    capexFacilities: 3,
    capexESGGreen: 4,
    newLoanAmount: 5,
    loanRepayment: 4,
    esgEnergyInvestment: 42,
    esgWasteManagement: 40,
    esgCommunityEngagement: 28,
    esgEmployeeDiversity: 26,
    taxStrategy: "STANDARD",
    createdAt: new Date("2026-03-10T00:00:00.000Z"),
    updatedAt: new Date("2026-03-12T00:00:00.000Z"),
    ...overrides,
  } as SimulationInput["teams"][number]["decision"];
}

export function createTeam(
  teamId: string,
  overrides: Partial<SimulationInput["teams"][number]["team"]> = {}
) {
  return {
    id: teamId,
    classId: "class-1",
    name: `Team ${teamId.toUpperCase()}`,
    hotelName: `Hotel ${teamId.toUpperCase()}`,
    color: "#8B1A1A",
    createdAt: new Date("2026-03-01T00:00:00.000Z"),
    updatedAt: new Date("2026-03-01T00:00:00.000Z"),
    ...overrides,
  } as SimulationInput["teams"][number]["team"];
}

export function createSimulationFixture(
  options: SimulationFixtureOptions = {}
): SimulationInput {
  const teamCount = options.teamCount ?? 4;
  const round = createRound(options.roundOverrides);
  const classConfig = createClassConfig({
    maxTeams: Math.max(teamCount, 1),
    ...options.classOverrides,
  });

  return {
    round,
    classConfig,
    parameters: DEFAULT_SIM_PARAMETERS,
    teams: Array.from({ length: teamCount }, (_, teamIndex) => {
      const teamId = `team-${teamIndex + 1}`;

      return {
        team: createTeam(teamId, options.teamMutator?.(teamIndex)),
        decision: createDecision(teamId, options.decisionMutator?.(teamIndex)),
        hotelState: createHotelState(
          teamId,
          options.hotelStateMutator?.(teamIndex)
        ),
      };
    }),
  };
}
