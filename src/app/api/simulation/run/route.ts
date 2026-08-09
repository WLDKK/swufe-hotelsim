import { ClassStatus, DecisionStatus, Prisma, RoundStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { recordAuditLog } from "@/lib/audit";
import {
  revalidateClassReadModels,
  revalidateRoundReadModels,
  revalidateTeamWorkspaceReadModels,
} from "@/lib/cache-invalidation";
import { getAccessibleClassRecord } from "@/lib/api/access";
import {
  apiError,
  apiSuccess,
  apiValidationError,
  mapRouteError,
} from "@/lib/api/responses";
import { requireApiRoles, requireApiSession } from "@/lib/api/session";
import { claimPendingRound, createRound, getRoundByClassAndNumber } from "@/lib/dal/rounds";
import { getActiveRuleset } from "@/lib/dal/rulesets";
import prisma from "@/lib/prisma";
import {
  buildDefaultRoundScenario,
  getNextClassStatus,
  resolveSimulationParameters,
  runRoundSimulation,
} from "@/lib/simulation/engine";
import { buildDefaultRulesetConfig, buildRoundRuntimeSnapshot } from "@/lib/simulation/rulesets";
import { simulationRunSchema } from "@/lib/validations/api";

// This handler is teacher/admin-only and session-backed, so it should always
// run dynamically rather than being considered for static optimization.
export const dynamic = "force-dynamic";

function toRoundSnapshotJsonValue(
  value: Prisma.JsonValue | Prisma.InputJsonValue | null | undefined,
  fallback: Prisma.InputJsonValue
): Prisma.JsonValue {
  if (value === null || value === undefined) {
    return fallback as Prisma.JsonValue;
  }

  return value as Prisma.JsonValue;
}

function toRoundSnapshotInputValue(
  value: Prisma.JsonValue | Prisma.InputJsonValue | null | undefined,
  fallback: Prisma.InputJsonValue
): Prisma.InputJsonValue {
  if (value === null || value === undefined) {
    return fallback;
  }

  return value as Prisma.InputJsonValue;
}

export async function POST(request: NextRequest) {
  let activeRoundId: string | null = null;

  try {
    const authResult = await requireApiSession();
    if ("response" in authResult) {
      return authResult.response;
    }

    const { session } = authResult;
    const roleError = requireApiRoles(session.user, ["TEACHER", "ADMIN"]);
    if (roleError) {
      return roleError;
    }

    const parsed = simulationRunSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiValidationError(parsed.error, "The simulation request is invalid.");
    }

    const accessibleClass = await getAccessibleClassRecord(
      session.user,
      parsed.data.classId
    );

    if (!accessibleClass) {
      return apiError(404, "Class not found.");
    }

    const classRecord = await prisma.class.findUnique({
      where: { id: parsed.data.classId },
      include: {
        rounds: {
          orderBy: {
            roundNumber: "asc",
          },
        },
      },
    });

    if (!classRecord) {
      return apiError(404, "Class not found.");
    }

    const activeRuleset = await getActiveRuleset();

    if (parsed.data.action === "initialize") {
      if (classRecord.currentRound > 0) {
        return apiError(
          409,
          "This class already has an active round. Use process instead of initialize."
        );
      }

      const defaultRoundScenario = buildDefaultRoundScenario(1);
      const roundScenario = {
        ...defaultRoundScenario,
        seasonFactor: parsed.data.seasonFactor ?? defaultRoundScenario.seasonFactor,
        economyFactor: parsed.data.economyFactor ?? defaultRoundScenario.economyFactor,
        eventFactor: parsed.data.eventFactor ?? defaultRoundScenario.eventFactor,
        eventDescription:
          parsed.data.eventDescription ?? defaultRoundScenario.eventDescription,
      };
      const roundSnapshot = buildRoundRuntimeSnapshot({
        classConfig: classRecord,
        roundNumber: 1,
        ruleset: activeRuleset,
      });
      const round = await createRound({
        classId: classRecord.id,
        ...roundScenario,
        ...roundSnapshot,
        randomSeed: parsed.data.randomSeed ?? roundSnapshot.randomSeed,
      });

      const updatedClass = await prisma.class.update({
        where: { id: classRecord.id },
        data: {
          currentRound: 1,
          status:
            classRecord.status === ClassStatus.SETUP
              ? ClassStatus.IN_PROGRESS
              : classRecord.status,
        },
      });

      await recordAuditLog({
        request,
        user: session.user,
        action: "simulation.initialize",
        entityType: "class",
        entityId: classRecord.id,
        details: {
          roundId: round.id,
          roundNumber: round.roundNumber,
          classStatus: updatedClass.status,
          seasonFactor: round.seasonFactor,
          economyFactor: round.economyFactor,
          eventFactor: round.eventFactor,
          rulesetVersion:
            round.rulesetVersion ?? activeRuleset?.version ?? buildDefaultRulesetConfig().version,
        },
      });

      revalidateClassReadModels({
        classId: updatedClass.id,
        semesterId: updatedClass.semesterId,
        joinCode: updatedClass.joinCode,
      });
      revalidateRoundReadModels({
        classId: updatedClass.id,
        roundId: round.id,
      });

      return apiSuccess(
        {
          message: "Round 1 has been initialized for this class.",
          class: updatedClass,
          round,
          parameters: resolveSimulationParameters(updatedClass),
          ruleset: activeRuleset ?? buildDefaultRulesetConfig(),
        },
        201
      );
    }

    if (classRecord.currentRound <= 0) {
      return apiError(
        409,
        "This class has not been initialized yet. Initialize round 1 first."
      );
    }

    const currentRound = await getRoundByClassAndNumber(
      classRecord.id,
      classRecord.currentRound
    );

    if (!currentRound) {
      return apiError(404, "The current round record could not be found.");
    }

    const fallbackSnapshot = buildRoundRuntimeSnapshot({
      classConfig: classRecord,
      roundNumber: currentRound.roundNumber,
      ruleset: activeRuleset,
    });
    const currentRoundSnapshot = {
      rulesetId: currentRound.rulesetId ?? fallbackSnapshot.rulesetId,
      rulesetVersion: currentRound.rulesetVersion ?? fallbackSnapshot.rulesetVersion,
      rulesetName: currentRound.rulesetName ?? fallbackSnapshot.rulesetName,
      parameterSnapshot: toRoundSnapshotInputValue(
        currentRound.parameterSnapshot,
        fallbackSnapshot.parameterSnapshot
      ),
      scoringSnapshot: toRoundSnapshotInputValue(
        currentRound.scoringSnapshot,
        fallbackSnapshot.scoringSnapshot
      ),
      randomSeed: currentRound.randomSeed ?? fallbackSnapshot.randomSeed,
      competitionStageId: currentRound.competitionStageId ?? null,
    };

    activeRoundId = currentRound.id;

    if (currentRound.status !== RoundStatus.PENDING) {
      return apiError(
        409,
        "Only pending rounds can be processed through the simulation engine."
      );
    }

    const teams = await prisma.team.findMany({
      where: { classId: classRecord.id },
      include: {
        hotelState: true,
        members: {
          select: {
            userId: true,
          },
        },
        decisions: {
          where: {
            roundId: currentRound.id,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    if (teams.length === 0) {
      return apiError(
        409,
        "This class does not have any teams yet, so there is nothing to simulate."
      );
    }

    const teamsMissingDecisions = teams
      .filter((team) => team.decisions.length === 0)
      .map((team) => ({
        teamId: team.id,
        teamName: team.name,
      }));

    if (teamsMissingDecisions.length > 0) {
      return apiError(
        409,
        "Every team must submit a decision before the round can be processed.",
        {
          missingTeams: teamsMissingDecisions,
        }
      );
    }

    const nonSubmittedTeams = teams
      .map((team) => ({
        teamId: team.id,
        teamName: team.name,
        decisionStatus: team.decisions[0]?.status ?? null,
      }))
      .filter((team) => team.decisionStatus !== DecisionStatus.SUBMITTED);

    if (nonSubmittedTeams.length > 0) {
      return apiError(
        409,
        "All team decisions must be in SUBMITTED status before processing.",
        {
          pendingTeams: nonSubmittedTeams,
        }
      );
    }

    const teamsWithoutHotelState = teams
      .filter((team) => !team.hotelState)
      .map((team) => ({
        teamId: team.id,
        teamName: team.name,
      }));

    if (teamsWithoutHotelState.length > 0) {
      return apiError(
        409,
        "Every team must have a hotel state before simulation can run.",
        {
          invalidTeams: teamsWithoutHotelState,
        }
      );
    }

    const claimedRound = await claimPendingRound(currentRound.id, currentRoundSnapshot);

    if (!claimedRound) {
      activeRoundId = null;
      return apiError(
        409,
        "This round is already being processed. Refresh before trying again."
      );
    }

    const processed = runRoundSimulation({
      round: {
        ...currentRound,
        rulesetId: currentRoundSnapshot.rulesetId,
        rulesetVersion: currentRoundSnapshot.rulesetVersion,
        rulesetName: currentRoundSnapshot.rulesetName,
        parameterSnapshot: toRoundSnapshotJsonValue(
          currentRound.parameterSnapshot,
          currentRoundSnapshot.parameterSnapshot
        ),
        scoringSnapshot: toRoundSnapshotJsonValue(
          currentRound.scoringSnapshot,
          currentRoundSnapshot.scoringSnapshot
        ),
        randomSeed: currentRoundSnapshot.randomSeed,
        competitionStageId: currentRoundSnapshot.competitionStageId,
      },
      classConfig: classRecord,
      parameters: resolveSimulationParameters(classRecord),
      teams: teams.map((team) => ({
        team: {
          id: team.id,
          classId: team.classId,
          name: team.name,
          hotelName: team.hotelName,
          color: team.color,
          createdAt: team.createdAt,
          updatedAt: team.updatedAt,
        },
        hotelState: team.hotelState!,
        decision: team.decisions[0],
      })),
    });

    const { nextRoundNumber, classStatus } = getNextClassStatus(classRecord);
    const nextRoundScenario = buildDefaultRoundScenario(nextRoundNumber);
    const nextRoundSnapshot = buildRoundRuntimeSnapshot({
      classConfig: classRecord,
      roundNumber: nextRoundNumber,
      ruleset: activeRuleset,
    });

    await prisma.$transaction(async (tx) => {
      for (const item of processed) {
        await tx.roundResult.upsert({
          where: {
            teamId_roundId: {
              teamId: item.teamId,
              roundId: currentRound.id,
            },
          },
          update: {
            ...item.result,
            roundNumber: currentRound.roundNumber,
          },
          create: {
            teamId: item.teamId,
            roundId: currentRound.id,
            ...item.result,
            roundNumber: currentRound.roundNumber,
          },
        });

        await tx.hotelState.update({
          where: { teamId: item.teamId },
          data: item.hotelStatePatch,
        });
      }

      await tx.decision.updateMany({
        where: {
          roundId: currentRound.id,
          status: DecisionStatus.SUBMITTED,
        },
        data: {
          status: DecisionStatus.LOCKED,
        },
      });

      await tx.round.update({
        where: { id: currentRound.id },
        data: {
          status: RoundStatus.COMPLETED,
          processedAt: new Date(),
          ...currentRoundSnapshot,
        },
      });

      if (classRecord.currentRound < classRecord.maxRounds) {
        await tx.round.upsert({
          where: {
            classId_roundNumber: {
              classId: classRecord.id,
              roundNumber: nextRoundNumber,
            },
          },
          update: {},
          create: {
            classId: classRecord.id,
            ...nextRoundScenario,
            ...nextRoundSnapshot,
          },
        });
      }

      await tx.class.update({
        where: { id: classRecord.id },
        data: {
          currentRound: nextRoundNumber,
          status: classStatus,
        },
      });
    });

    const latestClass = await prisma.class.findUnique({
      where: { id: classRecord.id },
      include: {
        rounds: {
          orderBy: {
            roundNumber: "asc",
          },
        },
      },
    });

    await recordAuditLog({
      request,
      user: session.user,
      action: "simulation.process",
      entityType: "class",
      entityId: classRecord.id,
      details: {
        processedRoundNumber: currentRound.roundNumber,
        nextRoundNumber:
          classRecord.currentRound < classRecord.maxRounds ? nextRoundNumber : null,
        classStatus,
        processedTeamCount: processed.length,
        rulesetVersion: currentRoundSnapshot.rulesetVersion,
      },
    });

    revalidateClassReadModels({
      classId: classRecord.id,
      semesterId: classRecord.semesterId,
      joinCode: classRecord.joinCode,
    });
    revalidateRoundReadModels({
      classId: classRecord.id,
      roundId: currentRound.id,
      teamIds: teams.map((team) => team.id),
    });
    // Revalidate the user-scoped team workspaces in one deduplicated pass.
    // The class- and round-level tags have already been invalidated above, so
    // repeating them once per team only adds cache churn during round
    // processing without improving freshness.
    revalidateTeamWorkspaceReadModels(
      Array.from(
        new Set(
          teams.flatMap((team) => team.members.map((member) => member.userId))
        )
      )
    );

    return apiSuccess({
      message:
        classRecord.currentRound < classRecord.maxRounds
          ? `Round ${currentRound.roundNumber} processed successfully.`
          : `Round ${currentRound.roundNumber} processed and the class is now complete.`,
      processedRoundNumber: currentRound.roundNumber,
      nextRoundNumber:
        classRecord.currentRound < classRecord.maxRounds ? nextRoundNumber : null,
      class: latestClass,
      results: processed.map((item) => ({
        teamId: item.teamId,
        ...item.result,
      })),
    });
  } catch (error) {
    if (activeRoundId) {
      await prisma.round.updateMany({
        where: {
          id: activeRoundId,
          status: RoundStatus.PROCESSING,
        },
        data: {
          status: RoundStatus.PENDING,
        },
      });
    }

    return mapRouteError(error);
  }
}
