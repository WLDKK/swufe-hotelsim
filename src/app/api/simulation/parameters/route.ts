import { NextRequest } from "next/server";
import { recordAuditLog } from "@/lib/audit";
import { revalidateClassReadModels } from "@/lib/cache-invalidation";
import { getAccessibleClassRecord } from "@/lib/api/access";
import { getOptionalSearchParam } from "@/lib/api/requests";
import {
  apiError,
  apiSuccess,
  apiValidationError,
  mapRouteError,
} from "@/lib/api/responses";
import { requireApiRoles, requireApiSession } from "@/lib/api/session";
import {
  getClassById,
  updateClassSimulationParameters,
} from "@/lib/dal/classes";
import {
  getCalibratedSimulationParameters,
  resolveSimulationParameters,
} from "@/lib/simulation/engine";
import { SIMULATION_FORMULA_MANIFEST } from "@/lib/simulation/formulas";
import { SIMULATION_PARAMETER_CATALOG } from "@/lib/simulation/parameters";
import { simulationParametersMutationSchema } from "@/lib/validations/api";

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

    const classRecord = await getClassById(classId);
    if (!classRecord) {
      return apiError(404, "Class not found.");
    }

    return apiSuccess({
      classId: classRecord.id,
      className: classRecord.name,
      currentRound: classRecord.currentRound,
      rawParameters: classRecord.simParameters,
      resolvedParameters: resolveSimulationParameters(classRecord),
      calibratedParameters: getCalibratedSimulationParameters(
        classRecord,
        classRecord.teams.length
      ),
      defaultParameters: resolveSimulationParameters({
        ...classRecord,
        simParameters: {},
      }),
      calibratedDefaultParameters: getCalibratedSimulationParameters(
        {
          ...classRecord,
          simParameters: {},
        },
        classRecord.teams.length
      ),
      parameterCatalog: SIMULATION_PARAMETER_CATALOG,
      formulaManifest: SIMULATION_FORMULA_MANIFEST,
    });
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

    const parsed = simulationParametersMutationSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiValidationError(parsed.error, "The simulation parameter payload is invalid.");
    }

    const accessibleClass = await getAccessibleClassRecord(
      session.user,
      parsed.data.classId
    );
    if (!accessibleClass) {
      return apiError(404, "Class not found.");
    }

    const previousClass = await getClassById(parsed.data.classId);
    if (!previousClass) {
      return apiError(404, "Class not found.");
    }

    const updatedClass = await updateClassSimulationParameters(
      parsed.data.classId,
      parsed.data.simParameters
    );

    revalidateClassReadModels({
      classId: updatedClass.id,
      semesterId: updatedClass.semesterId,
      teacherId: updatedClass.semester.creatorId,
      joinCode: updatedClass.joinCode,
    });

    await recordAuditLog({
      request,
      user: session.user,
      action: "simulation.parameters.update",
      entityType: "class",
      entityId: updatedClass.id,
      details: {
        previousParameters: resolveSimulationParameters(previousClass),
        nextParameters: resolveSimulationParameters(updatedClass),
      },
    });

    return apiSuccess({
      class: updatedClass,
      resolvedParameters: resolveSimulationParameters(updatedClass),
      calibratedParameters: getCalibratedSimulationParameters(
        updatedClass,
        accessibleClass._count.teams
      ),
      parameterCatalog: SIMULATION_PARAMETER_CATALOG,
      formulaManifest: SIMULATION_FORMULA_MANIFEST,
    });
  } catch (error) {
    return mapRouteError(error);
  }
}
