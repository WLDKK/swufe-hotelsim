import type { Prisma } from "@prisma/client";
import { cacheQuery } from "@/lib/cache";
import prisma from "@/lib/prisma";
import { calculateFinalScore } from "@/lib/simulation/scoring";

export async function listJudgeScoresForResult(resultId: string) {
  return cacheQuery(
    ["judge-scores", "result", resultId],
    () =>
      prisma.judgeScore.findMany({
        where: { resultId },
        include: {
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
      }),
    {}
  );
}

export async function upsertJudgeScoreForResult(input: {
  resultId: string;
  judgeId: string;
  score?: number | null;
  comment?: string | null;
  breakdown?: Prisma.InputJsonValue;
}) {
  return prisma.$transaction(async (tx) => {
    await tx.judgeScore.upsert({
      where: {
        resultId_judgeId: {
          resultId: input.resultId,
          judgeId: input.judgeId,
        },
      },
      update: {
        score: input.score ?? null,
        comment: input.comment ?? null,
        breakdown: input.breakdown,
      },
      create: {
        resultId: input.resultId,
        judgeId: input.judgeId,
        score: input.score ?? null,
        comment: input.comment ?? null,
        breakdown: input.breakdown,
      },
    });

    const result = await tx.roundResult.findUnique({
      where: { id: input.resultId },
      include: {
        round: {
          select: {
            id: true,
            classId: true,
            roundNumber: true,
            scoringSnapshot: true,
          },
        },
        team: {
          select: {
            id: true,
            classId: true,
            name: true,
            hotelName: true,
            color: true,
          },
        },
        judgeScores: {
          include: {
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
      },
    });

    if (!result) {
      throw new Error("Round result not found while syncing judge scores.");
    }

    const scoredEntries = result.judgeScores.filter(
      (entry) => typeof entry.score === "number"
    );
    const judgeScoreAverage =
      scoredEntries.length > 0
        ? scoredEntries.reduce((sum, entry) => sum + (entry.score ?? 0), 0) /
          scoredEntries.length
        : null;
    const latestComment =
      result.judgeScores.find(
        (entry) => typeof entry.comment === "string" && entry.comment.trim().length > 0
      )?.comment ?? null;
    const finalScore = calculateFinalScore({
      systemScore: result.systemScore,
      judgeScoreAverage,
      penaltyScore: result.penaltyScore,
      scoringSnapshot: result.round.scoringSnapshot,
    });

    return tx.roundResult.update({
      where: { id: input.resultId },
      data: {
        judgeScoreAverage,
        judgeScoreCount: scoredEntries.length,
        finalScore,
        // Preserve the legacy teacher-facing fields as a compatibility mirror
        // for existing Stage 3 pages and exports until those surfaces are fully
        // migrated to judge-score aware UI.
        teacherScore: judgeScoreAverage,
        teacherComment: latestComment,
      },
      include: {
        round: {
          select: {
            id: true,
            classId: true,
            roundNumber: true,
            processedAt: true,
            status: true,
            rulesetVersion: true,
          },
        },
        team: {
          select: {
            id: true,
            classId: true,
            name: true,
            hotelName: true,
            color: true,
          },
        },
        judgeScores: {
          include: {
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
      },
    });
  });
}
