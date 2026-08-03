import type { Prisma } from "@prisma/client";
import { cacheQuery, cacheTags } from "@/lib/cache";
import prisma from "@/lib/prisma";

export type UpsertRoundResultInput = Omit<Prisma.RoundResultUncheckedCreateInput, "id">;

const teamResultOrderBy = [{ roundNumber: "desc" }, { createdAt: "desc" }] satisfies
  Prisma.RoundResultOrderByWithRelationInput[];

const classRoundResultOrderBy = [
  { rankOverall: "asc" },
  { totalRevenue: "desc" },
] satisfies Prisma.RoundResultOrderByWithRelationInput[];

const roundResultWithTeamAndRound = {
  team: {
    select: {
      id: true,
      name: true,
      hotelName: true,
      color: true,
      classId: true,
    },
  },
  round: {
    select: {
      id: true,
      classId: true,
      roundNumber: true,
      status: true,
      processedAt: true,
      rulesetId: true,
      rulesetVersion: true,
      rulesetName: true,
      randomSeed: true,
    },
  },
  judgeScores: {
    select: {
      id: true,
      judgeId: true,
      score: true,
      comment: true,
      breakdown: true,
      createdAt: true,
      updatedAt: true,
      judge: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }],
  },
} satisfies Prisma.RoundResultInclude;

export type RoundResultWithTeamAndRound = Prisma.RoundResultGetPayload<{
  include: typeof roundResultWithTeamAndRound;
}>;

export async function upsertRoundResult(input: UpsertRoundResultInput) {
  return prisma.roundResult.upsert({
    where: {
      teamId_roundId: {
        teamId: input.teamId,
        roundId: input.roundId,
      },
    },
    update: input,
    create: input,
  });
}

export async function getLatestResultForTeam(teamId: string) {
  return cacheQuery(
    ["results", "team", teamId, "latest"],
    () =>
      prisma.roundResult.findFirst({
        where: { teamId },
        include: {
          round: true,
          team: true,
        },
        orderBy: teamResultOrderBy,
      }),
    {
      tags: [cacheTags.team(teamId), cacheTags.teamResults(teamId)],
    }
  );
}

export async function listResultsForTeam(teamId: string) {
  return cacheQuery(
    ["results", "team", teamId, "all"],
    () =>
      prisma.roundResult.findMany({
        where: { teamId },
        include: {
          round: true,
          team: true,
        },
        orderBy: teamResultOrderBy,
      }),
    {
      tags: [cacheTags.team(teamId), cacheTags.teamResults(teamId)],
    }
  );
}

export async function listCompletedRoundNumbersForClass(classId: string) {
  const rounds = await cacheQuery(
    ["results", "class", classId, "completed-rounds"],
    () =>
      prisma.roundResult.findMany({
        where: {
          team: {
            classId,
          },
        },
        select: {
          roundNumber: true,
        },
        distinct: ["roundNumber"],
        orderBy: {
          roundNumber: "desc",
        },
      }),
    {
      tags: [cacheTags.classResults(classId), cacheTags.classRounds(classId)],
    }
  );

  return rounds.map((round) => round.roundNumber);
}

export async function getLatestCompletedRoundNumberForClass(classId: string) {
  const latestResult = await cacheQuery(
    ["results", "class", classId, "latest-round"],
    () =>
      prisma.roundResult.findFirst({
        where: {
          team: {
            classId,
          },
        },
        select: {
          roundNumber: true,
        },
        orderBy: teamResultOrderBy,
      }),
    {
      tags: [cacheTags.classResults(classId), cacheTags.classRounds(classId)],
    }
  );

  return latestResult?.roundNumber ?? null;
}

export async function getResultsForClassRound(classId: string, roundNumber: number) {
  return cacheQuery(
    ["results", "class", classId, "round", roundNumber],
    () =>
      prisma.roundResult.findMany({
        where: {
          roundNumber,
          team: {
            classId,
          },
        },
        include: {
          team: true,
          round: true,
        },
        orderBy: classRoundResultOrderBy,
      }),
    {
      tags: [cacheTags.classResults(classId), cacheTags.classRounds(classId)],
    }
  );
}

export async function getRoundResultById(resultId: string) {
  return prisma.roundResult.findUnique({
    where: { id: resultId },
    include: roundResultWithTeamAndRound,
  });
}

export async function updateRoundResultTeacherFeedback(
  resultId: string,
  data: Prisma.RoundResultUpdateInput
) {
  return prisma.roundResult.update({
    where: { id: resultId },
    data,
    include: roundResultWithTeamAndRound,
  });
}

export async function getLeaderboardForClass(classId: string, roundNumber?: number) {
  const targetRound =
    roundNumber ??
    (await getLatestCompletedRoundNumberForClass(classId)) ??
    0;

  return cacheQuery(
    ["results", "class", classId, "leaderboard", targetRound],
    () =>
      prisma.roundResult.findMany({
        where: {
          roundNumber: targetRound,
          team: {
            classId,
          },
        },
        select: {
          teamId: true,
          rankOverall: true,
          rankRevenue: true,
          rankProfit: true,
          systemScore: true,
          judgeScoreAverage: true,
          judgeScoreCount: true,
          finalScore: true,
          occupancyRate: true,
          adr: true,
          revpar: true,
          totalRevenue: true,
          netProfit: true,
          overallMarketShare: true,
          team: {
            select: {
              id: true,
              name: true,
              hotelName: true,
              color: true,
            },
          },
        },
        orderBy: {
          rankOverall: "asc",
        },
      }),
    {
      tags: [cacheTags.classResults(classId), cacheTags.leaderboard(classId)],
    }
  );
}
