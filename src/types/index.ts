import type {
  Class,
  Decision,
  HotelState,
  Round,
  RoundResult,
  Semester,
  Team,
  TeamMember,
  User,
} from "@prisma/client";

// These aggregate types are intentionally colocated in one barrel so the next
// phases can import stable view-model shapes without repeating Prisma include types.
export type TeamWithMembers = Team & {
  members: (TeamMember & { user: Pick<User, "id" | "name" | "email"> })[];
};

export type ClassWithTeams = Class & {
  teams: TeamWithMembers[];
  semester: Semester;
  rounds: Round[];
};

export type RoundWithDecisions = Round & {
  decisions: Decision[];
  results: RoundResult[];
};

export type TeamDashboard = {
  team: TeamWithMembers;
  hotelState: HotelState;
  currentRound: Round | null;
  currentDecision: Decision | null;
  latestResult: RoundResult | null;
  allResults: RoundResult[];
};

// Stage 3 engine contracts depend on these shapes. Keeping them here avoids
// coupling the future simulation code to page components.
export type SimulationInput = {
  round: Round;
  classConfig: Class;
  teams: {
    team: Team;
    decision: Decision;
    hotelState: HotelState;
  }[];
  parameters: import("@/lib/constants").SimParameters;
};

export type SegmentResult = {
  segmentId: string;
  segmentName: string;
  demandAvailable: number;
  demandCaptured: number;
  roomsSold: number;
  revenue: number;
  marketShare: number;
  avgPrice: number;
};

export type SimulationOutput = {
  teamId: string;
  roundNumber: number;
  occupancyRate: number;
  adr: number;
  revpar: number;
  totalRoomsSold: number;
  totalRoomsAvailable: number;
  segmentResults: SegmentResult[];
  roomRevenue: number;
  fbRevenue: number;
  otherRevenue: number;
  totalRevenue: number;
  totalOpex: number;
  totalMarketing: number;
  totalCapex: number;
  depreciationExpense: number;
  interestExpense: number;
  taxExpense: number;
  grossOperatingProfit: number;
  ebitda: number;
  netProfit: number;
  profitMargin: number;
  overallMarketShare: number;
  brandReputationEnd: number;
  onlineRatingEnd: number;
  guestSatisfactionEnd: number;
  esgScoreEnd: number;
  cashBalanceEnd: number;
  totalDebtEnd: number;
  debtToEquityRatio: number;
  returnOnEquity: number;
  systemScore: number;
  systemScoreBreakdown: Record<string, unknown>;
  penaltyScore: number;
  explanationLog: Record<string, unknown>;
  judgeScoreAverage: number | null;
  judgeScoreCount: number;
  finalScore: number;
};
