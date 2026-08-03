import { ClassStatus, type Prisma, RoundStatus } from "@prisma/client";
import { cacheQuery, cacheTags } from "@/lib/cache";
import prisma from "@/lib/prisma";

export type CreateRoundInput = {
  classId: string;
  roundNumber: number;
  deadline?: Date;
  seasonFactor?: number;
  economyFactor?: number;
  eventFactor?: number;
  eventDescription?: string;
  rulesetId?: string | null;
  rulesetVersion?: string | null;
  rulesetName?: string | null;
  parameterSnapshot?: Prisma.InputJsonValue;
  scoringSnapshot?: Prisma.InputJsonValue;
  randomSeed?: string | null;
  competitionStageId?: string | null;
};

// Rounds are the coordination boundary between student decisions, teacher
// operations, and Stage 3 engine output. Keeping these helpers centralized
// avoids future API handlers reimplementing timeline/order logic.
export async function createRound(input: CreateRoundInput) {
  const data: Prisma.RoundUncheckedCreateInput = {
    classId: input.classId,
    roundNumber: input.roundNumber,
    status: RoundStatus.PENDING,
    deadline: input.deadline,
    seasonFactor: input.seasonFactor ?? 1,
    economyFactor: input.economyFactor ?? 1,
    eventFactor: input.eventFactor ?? 1,
    eventDescription: input.eventDescription,
    rulesetId: input.rulesetId ?? null,
    rulesetVersion: input.rulesetVersion ?? null,
    rulesetName: input.rulesetName ?? null,
    parameterSnapshot: input.parameterSnapshot,
    scoringSnapshot: input.scoringSnapshot,
    randomSeed: input.randomSeed ?? null,
    competitionStageId: input.competitionStageId ?? null,
  };

  return prisma.round.create({
    data,
  });
}

export async function createAndActivateRound(
  input: CreateRoundInput & {
    nextClassStatus: ClassStatus;
  }
) {
  return prisma.$transaction(async (tx) => {
    const roundCreateData: Prisma.RoundUncheckedCreateInput = {
      classId: input.classId,
      roundNumber: input.roundNumber,
      status: RoundStatus.PENDING,
      deadline: input.deadline,
      seasonFactor: input.seasonFactor ?? 1,
      economyFactor: input.economyFactor ?? 1,
      eventFactor: input.eventFactor ?? 1,
      eventDescription: input.eventDescription,
      rulesetId: input.rulesetId ?? null,
      rulesetVersion: input.rulesetVersion ?? null,
      rulesetName: input.rulesetName ?? null,
      parameterSnapshot: input.parameterSnapshot,
      scoringSnapshot: input.scoringSnapshot,
      randomSeed: input.randomSeed ?? null,
      competitionStageId: input.competitionStageId ?? null,
    };

    // Keep round creation and the class pointer update atomic so manual round
    // recovery does not leave behind an orphaned round record or a stale
    // currentRound pointer if one write succeeds and the other fails.
    const round = await tx.round.create({
      data: roundCreateData,
    });

    const classRecord = await tx.class.update({
      where: { id: input.classId },
      data: {
        currentRound: input.roundNumber,
        status: input.nextClassStatus,
      },
    });

    return {
      round,
      class: classRecord,
    };
  });
}

export async function listRoundsForClass(classId: string) {
  return cacheQuery(
    ["rounds", "class", classId],
    () =>
      prisma.round.findMany({
        where: { classId },
        include: {
          _count: {
            select: {
              decisions: true,
              results: true,
            },
          },
        },
        orderBy: {
          roundNumber: "asc",
        },
      }),
    {
      tags: [cacheTags.rounds, cacheTags.classRounds(classId), cacheTags.class(classId)],
    }
  );
}

export async function getRoundById(roundId: string) {
  return cacheQuery(
    ["rounds", "detail", roundId],
    () =>
      prisma.round.findUnique({
        where: { id: roundId },
        include: {
          class: true,
          decisions: {
            include: {
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
              updatedAt: "desc",
            },
          },
          results: {
            include: {
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
          },
        },
      }),
    {
      tags: [cacheTags.rounds, cacheTags.round(roundId)],
    }
  );
}

export async function getRoundByClassAndNumber(classId: string, roundNumber: number) {
  return cacheQuery(
    ["rounds", "class", classId, "number", roundNumber],
    () =>
      prisma.round.findUnique({
        where: {
          classId_roundNumber: {
            classId,
            roundNumber,
          },
        },
        include: {
          class: true,
          decisions: {
            include: {
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
              updatedAt: "desc",
            },
          },
          results: {
            include: {
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
          },
        },
      }),
    {
      tags: [cacheTags.rounds, cacheTags.classRounds(classId)],
    }
  );
}

export async function getCurrentRoundForClass(classId: string) {
  return cacheQuery(
    ["rounds", "class", classId, "current"],
    async () => {
      const classRecord = await prisma.class.findUnique({
        where: { id: classId },
        select: { currentRound: true },
      });

      if (!classRecord || classRecord.currentRound <= 0) {
        return null;
      }

      // Use the class's own currentRound pointer so student dashboards and teacher
      // controls resolve the same canonical "live round" record.
      return prisma.round.findUnique({
        where: {
          classId_roundNumber: {
            classId,
            roundNumber: classRecord.currentRound,
          },
        },
        include: {
          decisions: true,
          results: true,
        },
      });
    },
    {
      tags: [cacheTags.rounds, cacheTags.classRounds(classId), cacheTags.class(classId)],
    }
  );
}

export async function updateRoundStatus(
  roundId: string,
  status: RoundStatus,
  processedAt?: Date | null
) {
  return prisma.round.update({
    where: { id: roundId },
    data: {
      status,
      // Only completed rounds should carry a completion timestamp by default.
      processedAt:
        status === RoundStatus.COMPLETED ? processedAt ?? new Date() : processedAt ?? null,
    },
  });
}

export async function updateRoundEnvironment(input: {
  roundId: string;
  seasonFactor?: number;
  economyFactor?: number;
  eventFactor?: number;
  eventDescription?: string;
  randomSeed?: string | null;
}) {
  const data: Prisma.RoundUncheckedUpdateInput = {};

  if (input.seasonFactor !== undefined) {
    data.seasonFactor = input.seasonFactor;
  }

  if (input.economyFactor !== undefined) {
    data.economyFactor = input.economyFactor;
  }

  if (input.eventFactor !== undefined) {
    data.eventFactor = input.eventFactor;
  }

  if (input.eventDescription !== undefined) {
    data.eventDescription = input.eventDescription;
  }

  if (input.randomSeed !== undefined) {
    data.randomSeed = input.randomSeed;
  }

  return prisma.round.update({
    where: { id: input.roundId },
    data,
  });
}
