import { ClassStatus, RoundStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { recordAuditLog } from "@/lib/audit";
import {
  revalidateClassReadModels,
  revalidateRoundReadModels,
} from "@/lib/cache-invalidation";
import { getAccessibleClassRecord } from "@/lib/api/access";
import { getOptionalSearchParam } from "@/lib/api/requests";
import {
  apiError,
  apiSuccess,
  apiValidationError,
  mapRouteError,
} from "@/lib/api/responses";
import { requireApiRoles, requireApiSession } from "@/lib/api/session";
import { getClassById } from "@/lib/dal/classes";
import {
  createAndActivateRound,
  getRoundById,
  getRoundByClassAndNumber,
  listRoundsForClass,
  updateRoundEnvironment,
} from "@/lib/dal/rounds";
import { roundCreateSchema, roundUpdateSchema } from "@/lib/validations/api";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
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

    const classId = getOptionalSearchParam(request, "classId");
    if (!classId) {
      return apiError(400, "classId is required.");
    }

    const accessibleClass = await getAccessibleClassRecord(session.user, classId);
    if (!accessibleClass) {
      return apiError(404, "Class not found.");
    }

    // Keep the rounds endpoint class-centric so teacher integrations can fetch
    // one canonical timeline instead of stitching current round state together
    // from multiple detail endpoints.
    const rounds = await listRoundsForClass(classId);
    const currentRound =
      rounds.find((round) => round.roundNumber === accessibleClass.currentRound) ?? null;

    return apiSuccess({
      classId,
      currentRoundNumber: accessibleClass.currentRound,
      currentRound,
      rounds,
    });
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function POST(request: NextRequest) {
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

    const parsed = roundCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiValidationError(parsed.error, "The round request is invalid.");
    }

    const accessibleClass = await getAccessibleClassRecord(
      session.user,
      parsed.data.classId
    );
    if (!accessibleClass) {
      return apiError(404, "Class not found.");
    }

    if (parsed.data.competitionStageId) {
      const stage = await prisma.competitionStage.findFirst({
        where: {
          id: parsed.data.competitionStageId,
          ...(session.user.role === "ADMIN"
            ? {}
            : { competition: { createdById: session.user.id } }),
        },
        select: { id: true },
      });
      if (!stage) {
        return apiError(404, "Competition stage not found.");
      }
    }

    const classRecord = await getClassById(parsed.data.classId);
    if (!classRecord) {
      return apiError(404, "Class not found.");
    }

    const targetRoundNumber =
      parsed.data.roundNumber ??
      (classRecord.currentRound > 0 ? classRecord.currentRound + 1 : 1);

    if (targetRoundNumber > classRecord.maxRounds) {
      return apiError(
        409,
        `Round ${targetRoundNumber} exceeds the class limit of ${classRecord.maxRounds} rounds.`
      );
    }

    if (classRecord.currentRound <= 0 && targetRoundNumber !== 1) {
      return apiError(
        409,
        "A class without an active round can only create round 1 first."
      );
    }

    if (classRecord.currentRound > 0) {
      const currentRound = await getRoundByClassAndNumber(
        classRecord.id,
        classRecord.currentRound
      );

      if (!currentRound) {
        return apiError(404, "The current round record could not be found.");
      }

      if (currentRound.status !== RoundStatus.COMPLETED) {
        return apiError(
          409,
          "Create the next round only after the current round is fully completed."
        );
      }

      if (targetRoundNumber !== classRecord.currentRound + 1) {
        return apiError(
          409,
          `The next legal round number is ${classRecord.currentRound + 1}.`
        );
      }
    }

    const existingRound = await getRoundByClassAndNumber(
      classRecord.id,
      targetRoundNumber
    );
    if (existingRound) {
      return apiError(409, `Round ${targetRoundNumber} already exists for this class.`);
    }

    const created = await createAndActivateRound({
      classId: classRecord.id,
      roundNumber: targetRoundNumber,
      deadline: parsed.data.deadline,
      seasonFactor: parsed.data.seasonFactor,
      economyFactor: parsed.data.economyFactor,
      eventFactor: parsed.data.eventFactor,
      eventDescription: parsed.data.eventDescription,
      randomSeed: parsed.data.randomSeed,
      competitionStageId: parsed.data.competitionStageId,
      nextClassStatus:
        classRecord.status === ClassStatus.SETUP
          ? ClassStatus.IN_PROGRESS
          : classRecord.status,
    });

    await recordAuditLog({
      request,
      user: session.user,
      action: "round.create",
      entityType: "round",
      entityId: created.round.id,
      details: {
        classId: classRecord.id,
        roundNumber: created.round.roundNumber,
        deadline: created.round.deadline,
        seasonFactor: created.round.seasonFactor,
        economyFactor: created.round.economyFactor,
        eventFactor: created.round.eventFactor,
      },
    });

    revalidateClassReadModels({
      classId: classRecord.id,
      semesterId: classRecord.semesterId,
      teacherId: classRecord.semester?.creatorId ?? null,
      joinCode: classRecord.joinCode,
    });
    revalidateRoundReadModels({
      classId: classRecord.id,
      roundId: created.round.id,
    });

    return apiSuccess(
      {
        message: `Round ${created.round.roundNumber} has been created and activated.`,
        class: created.class,
        round: created.round,
      },
      201
    );
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function PATCH(request: NextRequest) {
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

    const parsed = roundUpdateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiValidationError(parsed.error, "The round environment payload is invalid.");
    }

    const round = await getRoundById(parsed.data.roundId);
    if (!round) {
      return apiError(404, "Round not found.");
    }

    const accessibleClass = await getAccessibleClassRecord(session.user, round.classId);
    if (!accessibleClass) {
      return apiError(404, "Class not found.");
    }

    if (round.status !== RoundStatus.PENDING) {
      return apiError(
        409,
        "Only pending rounds can be updated. Completed rounds stay read-only for replay integrity."
      );
    }


    if (parsed.data.competitionStageId) {
      const stage = await prisma.competitionStage.findFirst({
        where: {
          id: parsed.data.competitionStageId,
          ...(session.user.role === "ADMIN"
            ? {}
            : { competition: { createdById: session.user.id } }),
        },
        select: { id: true },
      });
      if (!stage) {
        return apiError(404, "Competition stage not found.");
      }
    }

    const updatedRound = await updateRoundEnvironment({
      roundId: round.id,
      seasonFactor: parsed.data.seasonFactor,
      economyFactor: parsed.data.economyFactor,
      eventFactor: parsed.data.eventFactor,
      eventDescription: parsed.data.eventDescription,
      randomSeed: parsed.data.randomSeed,
      competitionStageId: parsed.data.competitionStageId,
    });

    await recordAuditLog({
      request,
      user: session.user,
      action: "round.environment.update",
      entityType: "round",
      entityId: updatedRound.id,
      details: {
        classId: round.classId,
        roundNumber: updatedRound.roundNumber,
        seasonFactor: updatedRound.seasonFactor,
        economyFactor: updatedRound.economyFactor,
        eventFactor: updatedRound.eventFactor,
        randomSeed: updatedRound.randomSeed,
        competitionStageId: updatedRound.competitionStageId,
      },
    });

    revalidateRoundReadModels({
      classId: round.classId,
      roundId: updatedRound.id,
    });

    return apiSuccess({
      message: `Round ${updatedRound.roundNumber} environment has been updated.`,
      round: updatedRound,
    });
  } catch (error) {
    return mapRouteError(error);
  }
}
