import { TeamRole, UserRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { recordAuditLog } from "@/lib/audit";
import { revalidateTeamReadModels } from "@/lib/cache-invalidation";
import {
  getAccessibleClassRecord,
  getAccessibleTeamRecord,
} from "@/lib/api/access";
import {
  countPresentValues,
  getOptionalSearchParam,
} from "@/lib/api/requests";
import {
  apiError,
  apiSuccess,
  apiValidationError,
  mapRouteError,
} from "@/lib/api/responses";
import { requireApiRoles, requireApiSession } from "@/lib/api/session";
import {
  addTeamMember,
  createTeam,
  deleteTeamById,
  getTeamById,
  getTeamManagementById,
  getUserTeamInClass,
  listTeamsForClass,
  moveTeamMemberToTeam,
  removeTeamMember,
  setTeamLeader,
  updateTeamMetadata,
} from "@/lib/dal/teams";
import prisma from "@/lib/prisma";
import {
  teamCreateSchema,
  teamMutationSchema,
} from "@/lib/validations/api";

// These handlers depend on the authenticated session and must always execute
// dynamically instead of participating in static optimization.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireApiSession();
    if ("response" in authResult) {
      return authResult.response;
    }

    const { session } = authResult;
    const teamId = getOptionalSearchParam(request, "teamId");
    const classId = getOptionalSearchParam(request, "classId");

    if (countPresentValues([teamId, classId]) !== 1) {
      return apiError(400, "Provide exactly one of teamId or classId.");
    }

    if (teamId) {
      const accessibleTeam = await getAccessibleTeamRecord(session.user, teamId);
      if (!accessibleTeam) {
        return apiError(404, "Team not found.");
      }

      const team = await getTeamById(teamId);
      if (!team) {
        return apiError(404, "Team not found.");
      }

      return apiSuccess({ team });
    }

    const requestedClassId = classId;
    if (!requestedClassId) {
      return apiError(400, "Class not found.");
    }

    const accessibleClass = await getAccessibleClassRecord(
      session.user,
      requestedClassId
    );
    if (!accessibleClass) {
      return apiError(404, "Class not found.");
    }

    if (session.user.role === "STUDENT") {
      // Students are intentionally scoped to their own team record here. Later
      // roster/admin screens can use the teacher/admin branch below for the
      // full class view without weakening the student contract.
      const currentUserTeam = await getUserTeamInClass(
        session.user.id,
        requestedClassId
      );
      if (!currentUserTeam) {
        return apiSuccess({ teams: [] });
      }

      const team = await getTeamById(currentUserTeam.id);
      return apiSuccess({ teams: team ? [team] : [] });
    }

    const teams = await listTeamsForClass(requestedClassId);
    return apiSuccess({ teams });
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

    const parsed = teamCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiValidationError(parsed.error, "The team payload is invalid.");
    }

    const accessibleClass = await getAccessibleClassRecord(
      session.user,
      parsed.data.classId
    );

    if (!accessibleClass) {
      return apiError(404, "Class not found.");
    }

    // New teams are intentionally setup-only. Once round processing begins,
    // adding a brand-new team would create a cohort with no historical
    // decisions/results while the rest of the class already advanced.
    if (accessibleClass.currentRound > 0) {
      return apiError(
        409,
        "Teams can only be created before the class starts processing rounds."
      );
    }

    if (accessibleClass._count.teams >= accessibleClass.maxTeams) {
      return apiError(
        409,
        "This class has already reached its team limit.",
        {
          maxTeams: accessibleClass.maxTeams,
        }
      );
    }

    // Normalize the roster once here so every later rule sees the same member
    // set regardless of whether the leader was also repeated in memberUserIds.
    const memberIds = Array.from(
      new Set([
        parsed.data.leaderUserId,
        ...(parsed.data.memberUserIds ?? []),
      ])
    );

    if (memberIds.length < accessibleClass.minTeamSize) {
      return apiError(
        400,
        `Teams in this class must contain at least ${accessibleClass.minTeamSize} members.`
      );
    }

    if (memberIds.length > accessibleClass.maxTeamSize) {
      return apiError(
        400,
        `Teams in this class cannot exceed ${accessibleClass.maxTeamSize} members.`
      );
    }

    const [users, existingMemberships] = await Promise.all([
      prisma.user.findMany({
        where: {
          id: {
            in: memberIds,
          },
        },
        select: {
          id: true,
          role: true,
        },
      }),
      prisma.teamMember.findMany({
        where: {
          classId: parsed.data.classId,
          userId: {
            in: memberIds,
          },
        },
        select: {
          userId: true,
          team: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    ]);

    const existingUserIds = new Set(users.map((user) => user.id));
    const missingUserIds = memberIds.filter((userId) => !existingUserIds.has(userId));

    if (missingUserIds.length > 0) {
      return apiError(400, "One or more team members were not found.", {
        missingUserIds,
      });
    }

    const invalidRoleUserIds = users
      .filter((user) => user.role !== UserRole.STUDENT)
      .map((user) => user.id);

    if (invalidRoleUserIds.length > 0) {
      return apiError(
        400,
        "Only student accounts can be assigned to a team.",
        {
          invalidUserIds: invalidRoleUserIds,
        }
      );
    }

    if (existingMemberships.length > 0) {
      return apiError(
        409,
        "One or more selected students already belong to a team in this class.",
        {
          conflicts: existingMemberships.map((membership) => ({
            userId: membership.userId,
            teamId: membership.team.id,
            teamName: membership.team.name,
          })),
        }
      );
    }

    // Delegate the actual nested create to the DAL once all class-specific
    // business rules have passed, so the data-shaping logic still lives in one
    // place even though the route owns the validation policy.
    const team = await createTeam({
      ...parsed.data,
      memberUserIds: memberIds.filter(
        (memberUserId) => memberUserId !== parsed.data.leaderUserId
      ),
    });

    const hydratedTeam = await getTeamById(team.id);
    await recordAuditLog({
      request,
      user: session.user,
      action: "team.create",
      entityType: "team",
      entityId: team.id,
      details: {
        classId: parsed.data.classId,
        teamName: parsed.data.name,
        hotelName: parsed.data.hotelName,
        leaderUserId: parsed.data.leaderUserId,
        memberCount: memberIds.length,
      },
    });

    revalidateTeamReadModels({
      classId: parsed.data.classId,
      teamId: team.id,
      affectedUserIds: memberIds,
    });

    return apiSuccess({ team: hydratedTeam ?? team }, 201);
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

    const parsed = teamMutationSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiValidationError(parsed.error, "The team mutation payload is invalid.");
    }

    // Alias the discriminated-union payload once so each branch below narrows
    // cleanly and later handoff work can extend the action set without
    // re-reading `parsed.data` in every condition.
    const mutation = parsed.data;

    if (mutation.action === "moveMember") {
      const [accessibleSourceTeam, accessibleTargetTeam] = await Promise.all([
        getAccessibleTeamRecord(session.user, mutation.sourceTeamId),
        getAccessibleTeamRecord(session.user, mutation.targetTeamId),
      ]);

      if (!accessibleSourceTeam || !accessibleTargetTeam) {
        return apiError(404, "Team not found.");
      }

      const [sourceTeam, targetTeam] = await Promise.all([
        getTeamManagementById(mutation.sourceTeamId),
        getTeamManagementById(mutation.targetTeamId),
      ]);

      if (!sourceTeam || !targetTeam) {
        return apiError(404, "Team not found.");
      }

      if (sourceTeam.class.id !== targetTeam.class.id) {
        return apiError(
          400,
          "Members can only be moved between teams in the same class."
        );
      }

      const membership = sourceTeam.members.find(
        (member) => member.userId === mutation.userId
      );

      if (!membership) {
        return apiError(404, "The selected student does not belong to the source team.");
      }

      if (membership.role === TeamRole.LEADER) {
        return apiError(
          400,
          "Assign another leader before moving the current leader to a different team."
        );
      }

      if (sourceTeam.members.length - 1 < sourceTeam.class.minTeamSize) {
        return apiError(
          400,
          `Source teams in this class must keep at least ${sourceTeam.class.minTeamSize} members.`
        );
      }

      if (targetTeam.members.length + 1 > targetTeam.class.maxTeamSize) {
        return apiError(
          400,
          `Target teams in this class cannot exceed ${targetTeam.class.maxTeamSize} members.`
        );
      }

      if (
        targetTeam.members.some((member) => member.userId === mutation.userId)
      ) {
        return apiError(409, "The selected student already belongs to the target team.");
      }

      await moveTeamMemberToTeam(
        mutation.sourceTeamId,
        mutation.targetTeamId,
        mutation.userId
      );

      const team = await getTeamById(mutation.targetTeamId);
      await recordAuditLog({
        request,
        user: session.user,
        action: "team.member.move",
        entityType: "team",
        entityId: mutation.targetTeamId,
        details: {
          classId: sourceTeam.class.id,
          sourceTeamId: mutation.sourceTeamId,
          sourceTeamName: sourceTeam.name,
          targetTeamId: mutation.targetTeamId,
          targetTeamName: targetTeam.name,
          userId: mutation.userId,
        },
      });

      revalidateTeamReadModels({
        classId: sourceTeam.class.id,
        teamId: mutation.targetTeamId,
        affectedUserIds: [mutation.userId],
      });

      return apiSuccess({ team });
    }

    const accessibleTeam = await getAccessibleTeamRecord(session.user, mutation.teamId);
    if (!accessibleTeam) {
      return apiError(404, "Team not found.");
    }

    const teamManagement = await getTeamManagementById(mutation.teamId);
    if (!teamManagement) {
      return apiError(404, "Team not found.");
    }

    if (mutation.action === "updateMeta") {
      await updateTeamMetadata(mutation.teamId, {
        name: mutation.name,
        hotelName: mutation.hotelName,
        color: mutation.color,
      });

      const team = await getTeamById(mutation.teamId);
      await recordAuditLog({
        request,
        user: session.user,
        action: "team.meta.update",
        entityType: "team",
        entityId: mutation.teamId,
        details: {
          classId: accessibleTeam.classId,
          previousName: teamManagement.name,
          previousHotelName: teamManagement.hotelName,
          previousColor: teamManagement.color,
          nextName: mutation.name,
          nextHotelName: mutation.hotelName,
          nextColor: mutation.color,
        },
      });

      revalidateTeamReadModels({
        classId: accessibleTeam.classId,
        teamId: mutation.teamId,
      });

      return apiSuccess({ team });
    }

    if (mutation.action === "setLeader") {
      const previousLeader =
        teamManagement.members.find((member) => member.role === TeamRole.LEADER) ?? null;
      const nextLeader = teamManagement.members.find(
        (member) => member.userId === mutation.leaderUserId
      );

      if (!nextLeader) {
        return apiError(400, "The selected leader must already belong to this team.");
      }

      await setTeamLeader(mutation.teamId, mutation.leaderUserId);
      const team = await getTeamById(mutation.teamId);
      await recordAuditLog({
        request,
        user: session.user,
        action: "team.leader.set",
        entityType: "team",
        entityId: mutation.teamId,
        details: {
          classId: accessibleTeam.classId,
          previousLeaderUserId: previousLeader?.userId ?? null,
          nextLeaderUserId: mutation.leaderUserId,
        },
      });

      revalidateTeamReadModels({
        classId: accessibleTeam.classId,
        teamId: mutation.teamId,
        affectedUserIds: [mutation.leaderUserId],
      });

      return apiSuccess({ team });
    }

    if (mutation.action === "addMember") {
      if (teamManagement.members.length >= teamManagement.class.maxTeamSize) {
        return apiError(
          400,
          `Teams in this class cannot exceed ${teamManagement.class.maxTeamSize} members.`
        );
      }

      if (
        teamManagement.members.some((member) => member.userId === mutation.userId)
      ) {
        return apiError(409, "The selected student already belongs to this team.");
      }

      const [studentUser, existingMembership] = await Promise.all([
        prisma.user.findUnique({
          where: { id: mutation.userId },
          select: {
            id: true,
            role: true,
          },
        }),
        prisma.teamMember.findUnique({
          where: {
            classId_userId: {
              classId: teamManagement.class.id,
              userId: mutation.userId,
            },
          },
          select: {
            team: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        }),
      ]);

      if (!studentUser) {
        return apiError(404, "Student not found.");
      }

      if (studentUser.role !== UserRole.STUDENT) {
        return apiError(400, "Only student accounts can be assigned to a team.");
      }

      if (existingMembership) {
        return apiError(
          409,
          "The selected student already belongs to another team in this class.",
          {
            teamId: existingMembership.team.id,
            teamName: existingMembership.team.name,
          }
        );
      }

      // The class-level uniqueness guard above has already verified that this
      // student is free inside the target class, so the DAL can now perform
      // the actual membership insert in one place.
      await addTeamMember(mutation.teamId, mutation.userId);
      const team = await getTeamById(mutation.teamId);
      await recordAuditLog({
        request,
        user: session.user,
        action: "team.member.add",
        entityType: "team",
        entityId: mutation.teamId,
        details: {
          classId: accessibleTeam.classId,
          userId: mutation.userId,
        },
      });

      revalidateTeamReadModels({
        classId: accessibleTeam.classId,
        teamId: mutation.teamId,
        affectedUserIds: [mutation.userId],
      });

      return apiSuccess({ team });
    }

    if (mutation.action !== "removeMember") {
      // This keeps the final branch exhaustive. If a future action is added to
      // the validation schema but not implemented here yet, the route fails
      // loudly instead of silently falling through into remove-member logic.
      return apiError(400, "Unsupported team mutation.");
    }

    const membership = teamManagement.members.find(
      (member) => member.userId === mutation.userId
    );

    if (!membership) {
      return apiError(404, "The selected student does not belong to this team.");
    }

    if (membership.role === TeamRole.LEADER) {
      return apiError(
        400,
        "Assign another leader before removing the current leader from the team."
      );
    }

    if (teamManagement.members.length - 1 < teamManagement.class.minTeamSize) {
      return apiError(
        400,
        `Teams in this class must keep at least ${teamManagement.class.minTeamSize} members.`
      );
    }

    await removeTeamMember(mutation.teamId, mutation.userId);
    const team = await getTeamById(mutation.teamId);
    await recordAuditLog({
      request,
      user: session.user,
      action: "team.member.remove",
      entityType: "team",
      entityId: mutation.teamId,
      details: {
        classId: accessibleTeam.classId,
        userId: mutation.userId,
      },
    });

    revalidateTeamReadModels({
      classId: accessibleTeam.classId,
      teamId: mutation.teamId,
      affectedUserIds: [mutation.userId],
    });

    return apiSuccess({ team });
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function DELETE(request: NextRequest) {
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

    const teamId = getOptionalSearchParam(request, "teamId");
    if (!teamId) {
      return apiError(400, "Provide teamId when deleting a team.");
    }

    const accessibleTeam = await getAccessibleTeamRecord(session.user, teamId);
    if (!accessibleTeam) {
      return apiError(404, "Team not found.");
    }

    const teamManagement = await getTeamManagementById(teamId);
    if (!teamManagement) {
      return apiError(404, "Team not found.");
    }

    // Team deletion stays intentionally conservative. Once a class has started
    // processing rounds, deleting a team would orphan historical decisions and
    // results conceptually even though the database could cascade them.
    if (
      teamManagement.class.currentRound > 0 ||
      teamManagement._count.decisions > 0 ||
      teamManagement._count.results > 0
    ) {
      return apiError(
        409,
        "Only setup teams with no decision or result history can be deleted."
      );
    }

    await deleteTeamById(teamId);
    await recordAuditLog({
      request,
      user: session.user,
      action: "team.delete",
      entityType: "team",
      entityId: teamId,
      details: {
        classId: accessibleTeam.classId,
        teamName: teamManagement.name,
        memberCount: teamManagement.members.length,
      },
    });

    revalidateTeamReadModels({
      classId: accessibleTeam.classId,
      affectedUserIds: teamManagement.members.map((member) => member.userId),
    });

    return apiSuccess({ deletedTeamId: teamId });
  } catch (error) {
    return mapRouteError(error);
  }
}
