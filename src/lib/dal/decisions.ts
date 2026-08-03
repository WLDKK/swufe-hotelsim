import { DecisionStatus, Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

type DecisionNumericFieldKey =
  | "priceBusinessTransient"
  | "priceBusinessGroup"
  | "priceLeisureTransient"
  | "priceLeisureGroup"
  | "priceGovernment"
  | "priceOnlineOTA"
  | "priceAirlineCrew"
  | "priceLongStay"
  | "marketingTotal"
  | "mktBudgetBusinessTransient"
  | "mktBudgetBusinessGroup"
  | "mktBudgetLeisureTransient"
  | "mktBudgetLeisureGroup"
  | "mktBudgetGovernment"
  | "mktBudgetOnlineOTA"
  | "mktBudgetAirlineCrew"
  | "mktBudgetLongStay"
  | "channelDirect"
  | "channelOTA"
  | "channelTravelAgent"
  | "channelCorporate"
  | "channelGDS"
  | "opexRoomsMaintenance"
  | "opexFoodBeverage"
  | "opexFrontDesk"
  | "opexHousekeeping"
  | "opexUtilities"
  | "opexStaffTraining"
  | "opexStaffWelfare"
  | "opexSecurity"
  | "opexIT"
  | "capexRenovation"
  | "capexFurniture"
  | "capexTechnology"
  | "capexFacilities"
  | "capexESGGreen"
  | "newLoanAmount"
  | "loanRepayment"
  | "esgEnergyInvestment"
  | "esgWasteManagement"
  | "esgCommunityEngagement"
  | "esgEmployeeDiversity";

type DecisionStringFieldKey = "taxStrategy";
type DecisionFieldKeys = DecisionNumericFieldKey | DecisionStringFieldKey;
type DecisionPatch = Partial<Pick<Prisma.DecisionUncheckedCreateInput, DecisionFieldKeys>>;

const numericDecisionFields = [
  "priceBusinessTransient",
  "priceBusinessGroup",
  "priceLeisureTransient",
  "priceLeisureGroup",
  "priceGovernment",
  "priceOnlineOTA",
  "priceAirlineCrew",
  "priceLongStay",
  "marketingTotal",
  "mktBudgetBusinessTransient",
  "mktBudgetBusinessGroup",
  "mktBudgetLeisureTransient",
  "mktBudgetLeisureGroup",
  "mktBudgetGovernment",
  "mktBudgetOnlineOTA",
  "mktBudgetAirlineCrew",
  "mktBudgetLongStay",
  "channelDirect",
  "channelOTA",
  "channelTravelAgent",
  "channelCorporate",
  "channelGDS",
  "opexRoomsMaintenance",
  "opexFoodBeverage",
  "opexFrontDesk",
  "opexHousekeeping",
  "opexUtilities",
  "opexStaffTraining",
  "opexStaffWelfare",
  "opexSecurity",
  "opexIT",
  "capexRenovation",
  "capexFurniture",
  "capexTechnology",
  "capexFacilities",
  "capexESGGreen",
  "newLoanAmount",
  "loanRepayment",
  "esgEnergyInvestment",
  "esgWasteManagement",
  "esgCommunityEngagement",
  "esgEmployeeDiversity",
] as const satisfies readonly DecisionNumericFieldKey[];

const stringDecisionFields = ["taxStrategy"] as const satisfies readonly DecisionStringFieldKey[];

export type DecisionInput = {
  teamId: string;
  roundId: string;
  submittedBy?: string;
} & Partial<Pick<Prisma.DecisionUncheckedCreateInput, DecisionFieldKeys>>;

function buildDecisionPatch(input: DecisionInput): DecisionPatch {
  const patch: DecisionPatch = {};

  // Keeping these field lists explicit makes Stage 2 form binding and Stage 3
  // simulation validation easier to audit when schema fields evolve.
  for (const key of numericDecisionFields) {
    const value = input[key];
    if (typeof value === "number") {
      patch[key] = value;
    }
  }

  for (const key of stringDecisionFields) {
    const value = input[key];
    if (typeof value === "string") {
      patch[key] = value;
    }
  }

  return patch;
}

export async function getDecisionForTeamRound(teamId: string, roundId: string) {
  return prisma.decision.findUnique({
    where: {
      teamId_roundId: {
        teamId,
        roundId,
      },
    },
  });
}

export async function saveDecisionDraft(input: DecisionInput) {
  const patch = buildDecisionPatch(input);

  return prisma.decision.upsert({
    where: {
      teamId_roundId: {
        teamId: input.teamId,
        roundId: input.roundId,
      },
    },
    update: {
      ...patch,
      status: DecisionStatus.DRAFT,
      // If a previously submitted record is reopened as a draft, clear the
      // submission metadata so teacher dashboards do not read stale state.
      submittedAt: null,
      submittedBy: null,
    },
    create: {
      teamId: input.teamId,
      roundId: input.roundId,
      status: DecisionStatus.DRAFT,
      ...patch,
    },
  });
}

export async function submitDecision(input: DecisionInput) {
  const patch = buildDecisionPatch(input);

  return prisma.decision.upsert({
    where: {
      teamId_roundId: {
        teamId: input.teamId,
        roundId: input.roundId,
      },
    },
    update: {
      ...patch,
      status: DecisionStatus.SUBMITTED,
      submittedAt: new Date(),
      submittedBy: input.submittedBy,
    },
    create: {
      teamId: input.teamId,
      roundId: input.roundId,
      status: DecisionStatus.SUBMITTED,
      submittedAt: new Date(),
      submittedBy: input.submittedBy,
      ...patch,
    },
  });
}

export async function listDecisionsForRound(roundId: string) {
  return prisma.decision.findMany({
    where: { roundId },
    include: {
      team: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
}
