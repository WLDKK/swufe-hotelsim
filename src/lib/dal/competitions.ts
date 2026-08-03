import {
  CompetitionStageStatus,
  CompetitionStatus,
  Prisma,
  RoundStatus,
} from "@prisma/client";
import { cacheQuery, cacheTags } from "@/lib/cache";
import prisma from "@/lib/prisma";

const competitionSummaryInclude = Prisma.validator<Prisma.CompetitionInclude>()({
  ruleset: {
    select: {
      id: true,
      name: true,
      version: true,
      status: true,
    },
  },
  legacySemester: {
    select: {
      id: true,
      name: true,
      code: true,
      status: true,
    },
  },
  stages: {
    select: {
      id: true,
      name: true,
      stageOrder: true,
      status: true,
      maxRounds: true,
      _count: {
        select: {
          rounds: true,
          advancements: true,
        },
      },
    },
    orderBy: [{ stageOrder: "asc" }],
  },
}) satisfies Prisma.CompetitionInclude;

const stageSummaryInclude = Prisma.validator<Prisma.CompetitionStageInclude>()({
  competition: {
    select: {
      id: true,
      name: true,
      code: true,
      status: true,
    },
  },
  _count: {
    select: {
      rounds: true,
      advancements: true,
    },
  },
}) satisfies Prisma.CompetitionStageInclude;

const advancementInclude = Prisma.validator<Prisma.AdvancementInclude>()({
  competition: {
    select: {
      id: true,
      name: true,
      code: true,
      status: true,
    },
  },
  stage: {
    select: {
      id: true,
      name: true,
      stageOrder: true,
      status: true,
    },
  },
  team: {
    select: {
      id: true,
      name: true,
      hotelName: true,
      color: true,
      classId: true,
    },
  },
  sourceRound: {
    select: {
      id: true,
      roundNumber: true,
      status: true,
      classId: true,
    },
  },
  targetClass: {
    select: {
      id: true,
      name: true,
      semesterId: true,
      status: true,
    },
  },
}) satisfies Prisma.AdvancementInclude;

const announcementInclude = Prisma.validator<Prisma.AnnouncementInclude>()({
  competition: {
    select: {
      id: true,
      name: true,
      code: true,
      status: true,
    },
  },
  createdBy: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
}) satisfies Prisma.AnnouncementInclude;

const displayLeaderboardSelect = Prisma.validator<Prisma.RoundResultSelect>()({
  id: true,
  teamId: true,
  roundNumber: true,
  totalRevenue: true,
  netProfit: true,
  occupancyRate: true,
  adr: true,
  revpar: true,
  overallMarketShare: true,
  systemScore: true,
  judgeScoreAverage: true,
  judgeScoreCount: true,
  finalScore: true,
  rankRevenue: true,
  rankProfit: true,
  rankOverall: true,
  team: {
    select: {
      id: true,
      name: true,
      hotelName: true,
      color: true,
      class: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
}) satisfies Prisma.RoundResultSelect;

export type CompetitionSummary = Prisma.CompetitionGetPayload<{
  include: typeof competitionSummaryInclude;
}>;

export type CompetitionStageSummary = Prisma.CompetitionStageGetPayload<{
  include: typeof stageSummaryInclude;
}>;

export type AdvancementSummary = Prisma.AdvancementGetPayload<{
  include: typeof advancementInclude;
}>;

export type AnnouncementSummary = Prisma.AnnouncementGetPayload<{
  include: typeof announcementInclude;
}>;

export type DisplayLeaderboardEntry = Prisma.RoundResultGetPayload<{
  select: typeof displayLeaderboardSelect;
}>;

function isMissingCompetitionSchemaError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2021"
  );
}

async function withCompetitionSchemaFallback<T>(
  query: () => Promise<T>,
  fallback: T
) {
  try {
    return await query();
  } catch (error) {
    if (isMissingCompetitionSchemaError(error)) {
      return fallback;
    }

    throw error;
  }
}

export async function listCompetitions(status?: CompetitionStatus) {
  return cacheQuery(
    ["competitions", "list", status ?? "all"],
    () =>
      withCompetitionSchemaFallback(
        () =>
          prisma.competition.findMany({
            where: status ? { status } : undefined,
            include: competitionSummaryInclude,
            orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
          }),
        [] as CompetitionSummary[]
      ),
    {
      tags: [cacheTags.competitions],
    }
  );
}

export async function getCompetitionById(competitionId: string) {
  return cacheQuery(
    ["competitions", "detail", competitionId],
    () =>
      withCompetitionSchemaFallback(
        () =>
          prisma.competition.findUnique({
            where: { id: competitionId },
            include: competitionSummaryInclude,
          }),
        null
      ),
    {
      tags: [cacheTags.competitions, cacheTags.competition(competitionId)],
    }
  );
}

export async function getActiveCompetition() {
  return cacheQuery(
    ["competitions", "active"],
    () =>
      withCompetitionSchemaFallback(
        () =>
          prisma.competition.findFirst({
            where: {
              status: {
                in: [CompetitionStatus.ACTIVE, CompetitionStatus.READY],
              },
            },
            include: competitionSummaryInclude,
            orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
          }),
        null
      ),
    {
      tags: [cacheTags.competitions],
    }
  );
}

export async function createCompetition(input: Prisma.CompetitionUncheckedCreateInput) {
  return prisma.competition.create({
    data: input,
    include: competitionSummaryInclude,
  });
}

export async function listCompetitionStages(competitionId?: string) {
  return cacheQuery(
    ["competition-stages", competitionId ?? "all"],
    () =>
      withCompetitionSchemaFallback(
        () =>
          prisma.competitionStage.findMany({
            where: competitionId ? { competitionId } : undefined,
            include: stageSummaryInclude,
            orderBy: [{ updatedAt: "desc" }, { stageOrder: "asc" }],
          }),
        [] as CompetitionStageSummary[]
      ),
    {
      tags: [
        cacheTags.stages,
        competitionId ? cacheTags.competition(competitionId) : null,
      ],
    }
  );
}

export async function createCompetitionStage(
  input: Prisma.CompetitionStageUncheckedCreateInput
) {
  return prisma.competitionStage.create({
    data: input,
    include: stageSummaryInclude,
  });
}

export async function listAdvancements(input: {
  competitionId?: string;
  stageId?: string;
  teamId?: string;
}) {
  return cacheQuery(
    [
      "advancements",
      input.competitionId ?? "all",
      input.stageId ?? "all",
      input.teamId ?? "all",
    ],
    () =>
      withCompetitionSchemaFallback(
        () =>
          prisma.advancement.findMany({
            where: {
              ...(input.competitionId ? { competitionId: input.competitionId } : {}),
              ...(input.stageId ? { stageId: input.stageId } : {}),
              ...(input.teamId ? { teamId: input.teamId } : {}),
            },
            include: advancementInclude,
            orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
          }),
        [] as AdvancementSummary[]
      ),
    {
      tags: [
        cacheTags.advancements,
        input.competitionId ? cacheTags.competition(input.competitionId) : null,
        input.stageId ? cacheTags.stage(input.stageId) : null,
      ],
    }
  );
}

export async function createAdvancement(input: Prisma.AdvancementUncheckedCreateInput) {
  return prisma.advancement.create({
    data: input,
    include: advancementInclude,
  });
}

export async function listAnnouncements(input?: {
  competitionId?: string;
  publishedOnly?: boolean;
}) {
  return cacheQuery(
    [
      "announcements",
      input?.competitionId ?? "all",
      input?.publishedOnly === false ? "all" : "published",
    ],
    () =>
      withCompetitionSchemaFallback(
        () =>
          prisma.announcement.findMany({
            where: {
              ...(input?.competitionId ? { competitionId: input.competitionId } : {}),
              ...(input?.publishedOnly === false ? {} : { isPublished: true }),
            },
            include: announcementInclude,
            orderBy: [
              { isPinned: "desc" },
              { publishedAt: "desc" },
              { createdAt: "desc" },
            ],
          }),
        [] as AnnouncementSummary[]
      ),
    {
      tags: [
        cacheTags.announcements,
        input?.competitionId ? cacheTags.competition(input.competitionId) : null,
      ],
    }
  );
}

export async function createAnnouncement(input: Prisma.AnnouncementUncheckedCreateInput) {
  return prisma.announcement.create({
    data: input,
    include: announcementInclude,
  });
}

export async function getJudgeDashboardSnapshot(judgeId: string) {
  const [activeCompetition, recentAnnouncements, recentScores] = await Promise.all([
    getActiveCompetition(),
    listAnnouncements({ publishedOnly: false }),
    withCompetitionSchemaFallback(
      () =>
        prisma.judgeScore.findMany({
          where: { judgeId },
          select: {
            id: true,
            score: true,
            updatedAt: true,
            result: {
              select: {
                id: true,
                roundNumber: true,
                team: {
                  select: {
                    id: true,
                    name: true,
                    hotelName: true,
                  },
                },
                round: {
                  select: {
                    id: true,
                    classId: true,
                    class: {
                      select: {
                        id: true,
                        name: true,
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: [{ updatedAt: "desc" }],
          take: 8,
        }),
      []
    ),
  ]);

  const latestCompetitionRound = await withCompetitionSchemaFallback(
    () =>
      prisma.round.findFirst({
        where: {
          status: RoundStatus.COMPLETED,
          competitionStage: {
            is: {
              competition: {
                status: {
                  in: [
                    CompetitionStatus.ACTIVE,
                    CompetitionStatus.READY,
                    CompetitionStatus.COMPLETED,
                  ],
                },
              },
            },
          },
        },
        select: {
          id: true,
          roundNumber: true,
          processedAt: true,
          seasonFactor: true,
          economyFactor: true,
          eventFactor: true,
          eventDescription: true,
          randomSeed: true,
          class: {
            select: {
              id: true,
              name: true,
            },
          },
          competitionStage: {
            select: {
              id: true,
              name: true,
              stageOrder: true,
              status: true,
              competition: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
            },
          },
        },
        orderBy: [{ processedAt: "desc" }, { roundNumber: "desc" }],
      }),
    null
  );

  const pendingScoreCount = latestCompetitionRound
    ? await withCompetitionSchemaFallback(
        () =>
          prisma.roundResult.count({
            where: {
              roundId: latestCompetitionRound.id,
              judgeScores: {
                none: {
                  judgeId,
                },
              },
            },
          }),
        0
      )
    : 0;

  return {
    activeCompetition,
    latestCompetitionRound,
    pendingScoreCount,
    recentAnnouncements: recentAnnouncements.slice(0, 6),
    recentScores,
  };
}

export async function getDisplayLeaderboardSnapshot() {
  const latestCompetitionRound = await withCompetitionSchemaFallback(
    () =>
      prisma.round.findFirst({
        where: {
          status: RoundStatus.COMPLETED,
          competitionStage: {
            is: {
              competition: {
                status: {
                  in: [
                    CompetitionStatus.ACTIVE,
                    CompetitionStatus.READY,
                    CompetitionStatus.COMPLETED,
                  ],
                },
              },
            },
          },
        },
        select: {
          id: true,
          roundNumber: true,
          processedAt: true,
          seasonFactor: true,
          economyFactor: true,
          eventFactor: true,
          eventDescription: true,
          randomSeed: true,
          class: {
            select: {
              id: true,
              name: true,
            },
          },
          competitionStage: {
            select: {
              id: true,
              name: true,
              stageOrder: true,
              status: true,
              competition: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  status: true,
                },
              },
            },
          },
        },
        orderBy: [{ processedAt: "desc" }, { roundNumber: "desc" }],
      }),
    null
  );

  const latestTeachingRound = latestCompetitionRound
    ? null
    : await withCompetitionSchemaFallback(
        () =>
          prisma.round.findFirst({
            where: {
              status: RoundStatus.COMPLETED,
            },
            select: {
              id: true,
              roundNumber: true,
              processedAt: true,
              seasonFactor: true,
              economyFactor: true,
              eventFactor: true,
              eventDescription: true,
              randomSeed: true,
              class: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            orderBy: [{ processedAt: "desc" }, { roundNumber: "desc" }],
          }),
        null
      );

  const targetRoundId = latestCompetitionRound?.id ?? latestTeachingRound?.id;
  if (!targetRoundId) {
    return {
      snapshot: null,
      leaderboard: [] as DisplayLeaderboardEntry[],
    };
  }

  const leaderboard = await withCompetitionSchemaFallback(
    () =>
      prisma.roundResult.findMany({
        where: { roundId: targetRoundId },
        select: displayLeaderboardSelect,
        orderBy: [
          { rankOverall: "asc" },
          { finalScore: "desc" },
          { totalRevenue: "desc" },
        ],
      }),
    [] as DisplayLeaderboardEntry[]
  );

  return {
    snapshot: latestCompetitionRound ?? latestTeachingRound,
    leaderboard,
  };
}

export async function getCompetitionReadinessSnapshot() {
  const [competitions, stages, advancements, announcements] = await Promise.all([
    listCompetitions(),
    listCompetitionStages(),
    listAdvancements({}),
    listAnnouncements({ publishedOnly: false }),
  ]);

  const activeStageCount = stages.filter(
    (stage) => stage.status === CompetitionStageStatus.ACTIVE
  ).length;

  return {
    competitions,
    stages,
    advancements,
    announcements,
    metrics: {
      totalCompetitions: competitions.length,
      activeCompetitions: competitions.filter(
        (competition) =>
          competition.status === CompetitionStatus.ACTIVE ||
          competition.status === CompetitionStatus.READY
      ).length,
      activeStageCount,
      advancementCount: advancements.length,
      publishedAnnouncementCount: announcements.filter(
        (announcement) => announcement.isPublished
      ).length,
    },
  };
}
