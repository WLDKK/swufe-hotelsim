import { DecisionStatus, RoundStatus } from "@prisma/client";
import { cacheQuery, cacheTags } from "@/lib/cache";
import prisma from "@/lib/prisma";

export async function getPlatformObservabilitySnapshot() {
  return cacheQuery(
    ["observability", "platform"],
    async () => {
      const now = new Date();
      const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const [activeClasses, activeClassRounds, ungradedResults, recentAuditLogs] =
        await Promise.all([
          prisma.class.count({
            where: {
              status: "IN_PROGRESS",
            },
          }),
          prisma.class.findMany({
            where: {
              currentRound: {
                gt: 0,
              },
            },
            select: {
              id: true,
              name: true,
              currentRound: true,
              maxRounds: true,
              status: true,
              _count: {
                select: {
                  teams: true,
                },
              },
              // Only load the current actionable round state so the admin
              // dashboard can summarize submission pressure without replaying the
              // entire class history client-side.
              rounds: {
                where: {
                  status: {
                    in: [RoundStatus.PENDING, RoundStatus.PROCESSING],
                  },
                },
                select: {
                  id: true,
                  roundNumber: true,
                  status: true,
                  deadline: true,
                  createdAt: true,
                  decisions: {
                    select: {
                      status: true,
                    },
                  },
                },
                orderBy: {
                  roundNumber: "asc",
                },
              },
            },
          }),
          prisma.roundResult.findMany({
            where: {
              teacherScore: null,
            },
            select: {
              id: true,
              roundNumber: true,
              team: {
                select: {
                  classId: true,
                  class: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
          }),
          prisma.auditLog.findMany({
            where: {
              createdAt: {
                gte: last24Hours,
              },
            },
            select: {
              action: true,
            },
          }),
        ]);

      const roundSignals = activeClassRounds
        .map((courseClass) => {
          const activeRound =
            courseClass.rounds.find(
              (round) => round.roundNumber === courseClass.currentRound
            ) ?? null;

          if (!activeRound) {
            return null;
          }

          const submittedTeams = activeRound.decisions.filter(
            (decision) => decision.status === DecisionStatus.SUBMITTED
          ).length;
          const totalTeams = courseClass._count.teams;
          const missingTeams = Math.max(totalTeams - submittedTeams, 0);
          const overdue =
            activeRound.status === RoundStatus.PENDING &&
            Boolean(activeRound.deadline && activeRound.deadline.getTime() < now.getTime());

          return {
            classId: courseClass.id,
            className: courseClass.name,
            classStatus: courseClass.status,
            roundId: activeRound.id,
            roundNumber: activeRound.roundNumber,
            roundStatus: activeRound.status,
            deadline: activeRound.deadline,
            openedAt: activeRound.createdAt,
            totalTeams,
            submittedTeams,
            missingTeams,
            overdue,
          };
        })
        .filter((signal): signal is NonNullable<typeof signal> => Boolean(signal))
        .sort((left, right) => {
          if (left.roundStatus !== right.roundStatus) {
            return left.roundStatus === RoundStatus.PROCESSING ? -1 : 1;
          }

          if (left.overdue !== right.overdue) {
            return left.overdue ? -1 : 1;
          }

          return left.className.localeCompare(right.className, "en", {
            sensitivity: "base",
          });
        });

      const gradingSignals = Array.from(
        ungradedResults
          .reduce((signals, result) => {
            const key = result.team.classId;
            const existing = signals.get(key);

            if (existing) {
              existing.ungradedResults += 1;
              existing.latestUngradedRound = Math.max(
                existing.latestUngradedRound,
                result.roundNumber
              );
            } else {
              signals.set(key, {
                classId: result.team.classId,
                className: result.team.class.name,
                ungradedResults: 1,
                latestUngradedRound: result.roundNumber,
              });
            }

            return signals;
          }, new Map<string, { classId: string; className: string; ungradedResults: number; latestUngradedRound: number }>())
          .values()
      )
        .sort((left, right) => right.ungradedResults - left.ungradedResults)
        .slice(0, 6);

      const auditActions = Array.from(
        recentAuditLogs.reduce((counts, auditLog) => {
          counts.set(auditLog.action, (counts.get(auditLog.action) ?? 0) + 1);
          return counts;
        }, new Map<string, number>())
      )
        .map(([action, count]) => ({
          action,
          count,
        }))
        .sort((left, right) => right.count - left.count)
        .slice(0, 6);

      return {
        summary: {
          activeClasses,
          activeProcessingRounds: roundSignals.filter(
            (signal) => signal.roundStatus === RoundStatus.PROCESSING
          ).length,
          overduePendingRounds: roundSignals.filter((signal) => signal.overdue).length,
          classesAwaitingSubmissions: roundSignals.filter(
            (signal) =>
              signal.roundStatus === RoundStatus.PENDING && signal.missingTeams > 0
          ).length,
          missingSubmissions: roundSignals.reduce(
            (sum, signal) =>
              signal.roundStatus === RoundStatus.PENDING ? sum + signal.missingTeams : sum,
            0
          ),
          ungradedResults: ungradedResults.length,
          auditEventsLast24Hours: recentAuditLogs.length,
        },
        roundSignals,
        gradingSignals,
        auditActions,
        generatedAt: now.toISOString(),
      };
    },
    {
      tags: [cacheTags.observability, cacheTags.alerts, cacheTags.audit],
    }
  );
}
