import { ClassStatus, Prisma, TeamRole } from "@prisma/client";
import { cacheQuery, cacheTags } from "@/lib/cache";
import prisma from "@/lib/prisma";

export type CreateTeamInput = {
  classId: string;
  name: string;
  hotelName: string;
  color?: string;
  leaderUserId: string;
  memberUserIds?: string[];
};

export type ReplaceClassRosterTeamInput = {
  name: string;
  hotelName: string;
  color?: string | null;
  members: Array<{
    userId: string;
    role: TeamRole;
  }>;
};

export async function createTeam(input: CreateTeamInput) {
  const memberIds = Array.from(new Set([input.leaderUserId, ...(input.memberUserIds ?? [])]));

  return prisma.team.create({
    data: {
      class: {
        connect: { id: input.classId },
      },
      name: input.name,
      hotelName: input.hotelName,
      color: input.color ?? "#8B1A1A",
      members: {
        create: memberIds.map((userId) => ({
          class: {
            connect: { id: input.classId },
          },
          user: {
            connect: { id: userId },
          },
          role: userId === input.leaderUserId ? TeamRole.LEADER : TeamRole.MEMBER,
        })),
      },
      hotelState: {
        create: {},
      },
    },
    include: {
      members: true,
      hotelState: true,
    },
  });
}

export async function addTeamMember(teamId: string, userId: string, role = TeamRole.MEMBER) {
  // TeamMember stores classId directly so the database can enforce "one team
  // per student per class" without depending on app-layer checks.
  const team = await prisma.team.findUniqueOrThrow({
    where: { id: teamId },
    select: { classId: true },
  });

  return prisma.teamMember.create({
    data: {
      team: {
        connect: { id: teamId },
      },
      class: {
        connect: { id: team.classId },
      },
      user: {
        connect: { id: userId },
      },
      role,
    },
  });
}

export async function updateTeamMetadata(
  teamId: string,
  data: {
    name: string;
    hotelName: string;
    color?: string;
  }
) {
  return prisma.team.update({
    where: { id: teamId },
    data: {
      name: data.name,
      hotelName: data.hotelName,
      color: data.color,
    },
  });
}

export async function setTeamLeader(teamId: string, leaderUserId: string) {
  return prisma.$transaction(async (tx) => {
    const currentLeader = await tx.teamMember.findFirst({
      where: {
        teamId,
        role: TeamRole.LEADER,
      },
      select: {
        id: true,
        userId: true,
      },
    });

    if (currentLeader && currentLeader.userId !== leaderUserId) {
      await tx.teamMember.update({
        where: { id: currentLeader.id },
        data: { role: TeamRole.MEMBER },
      });
    }

    return tx.teamMember.update({
      where: {
        teamId_userId: {
          teamId,
          userId: leaderUserId,
        },
      },
      data: {
        role: TeamRole.LEADER,
      },
    });
  });
}

export async function removeTeamMember(teamId: string, userId: string) {
  return prisma.teamMember.delete({
    where: {
      teamId_userId: {
        teamId,
        userId,
      },
    },
  });
}

export async function moveTeamMemberToTeam(
  sourceTeamId: string,
  targetTeamId: string,
  userId: string
) {
  return prisma.teamMember.update({
    where: {
      teamId_userId: {
        teamId: sourceTeamId,
        userId,
      },
    },
    data: {
      teamId: targetTeamId,
    },
  });
}

export async function deleteTeamById(teamId: string) {
  return prisma.team.delete({
    where: { id: teamId },
  });
}

export async function getClassRosterImportState(classId: string) {
  return prisma.class.findUnique({
    where: { id: classId },
    select: {
      id: true,
      currentRound: true,
      teams: {
        select: {
          id: true,
          _count: {
            select: {
              decisions: true,
              results: true,
            },
          },
        },
      },
    },
  });
}

export async function replaceClassRoster(
  classId: string,
  teams: ReplaceClassRosterTeamInput[]
) {
  return prisma.$transaction(async (tx) => {
    // Bulk CSV import is intentionally modeled as a setup-phase replacement so
    // admins can rebuild a roster from a spreadsheet without replaying dozens
    // of per-member mutations through the interactive UI first.
    await tx.team.deleteMany({
      where: { classId },
    });

    const createdTeamIds: string[] = [];

    for (const team of teams) {
      const createdTeam = await tx.team.create({
        data: {
          class: {
            connect: { id: classId },
          },
          name: team.name,
          hotelName: team.hotelName,
          color: team.color ?? "#8B1A1A",
          members: {
            create: team.members.map((member) => ({
              class: {
                connect: { id: classId },
              },
              user: {
                connect: { id: member.userId },
              },
              role: member.role,
            })),
          },
          hotelState: {
            create: {},
          },
        },
        select: {
          id: true,
        },
      });

      createdTeamIds.push(createdTeam.id);
    }

    return {
      classId,
      createdTeamIds,
    };
  });
}

export async function getTeamManagementById(teamId: string) {
  return prisma.team.findUnique({
    where: { id: teamId },
    include: {
      class: {
        select: {
          id: true,
          currentRound: true,
          minTeamSize: true,
          maxTeamSize: true,
        },
      },
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              studentId: true,
              role: true,
            },
          },
        },
      },
      _count: {
        select: {
          decisions: true,
          results: true,
        },
      },
    },
  });
}

export async function getTeamById(teamId: string) {
  return cacheQuery(
    ["teams", "detail", teamId],
    () =>
      prisma.team.findUnique({
        where: { id: teamId },
        include: {
          class: true,
          hotelState: true,
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  studentId: true,
                },
              },
            },
          },
        },
      }),
    {
      tags: [cacheTags.team(teamId)],
    }
  );
}

export async function listTeamsForClass(classId: string) {
  return cacheQuery(
    ["teams", "class", classId],
    () =>
      prisma.team.findMany({
        where: { classId },
        include: {
          hotelState: true,
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  studentId: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      }),
    {
      tags: [cacheTags.classTeams(classId), cacheTags.class(classId)],
    }
  );
}

export async function getUserTeamInClass(userId: string, classId: string) {
  // Query the denormalized classId relation directly so Prisma can use the
  // unique (classId, userId) constraint added for this exact business rule.
  const membership = await cacheQuery(
    ["teams", "class", classId, "user", userId],
    () =>
      prisma.teamMember.findUnique({
        where: {
          classId_userId: {
            classId,
            userId,
          },
        },
        include: {
          team: {
            include: {
              hotelState: true,
              class: true,
            },
          },
        },
      }),
    {
      tags: [cacheTags.classTeams(classId), cacheTags.teamWorkspace(userId)],
    }
  );

  return membership?.team ?? null;
}

export type StudentDecisionWorkspace = {
  team: {
    id: string;
    name: string;
    hotelName: string;
    color: string;
    classId: string;
    hotelState: {
      cashBalance: number;
      totalDebt: number;
      brandReputation: number;
      guestSatisfaction: number;
      esgScore: number;
    } | null;
  };
  courseClass: {
    id: string;
    name: string;
    status: ClassStatus;
    currentRound: number;
    maxRounds: number;
    semester: {
      id: string;
      name: string;
      code: string;
    };
  };
  round: {
    id: string;
    roundNumber: number;
    status: string;
    seasonFactor: number;
    economyFactor: number;
    eventFactor: number;
    eventDescription: string | null;
    randomSeed: string | null;
    // `unstable_cache` can hydrate Prisma Date fields back as ISO strings on
    // later reads, so the student workspace contract reflects both shapes.
    deadline: Date | string | null;
    processedAt: Date | string | null;
  } | null;
};

const classStatusPriority: Record<ClassStatus, number> = {
  IN_PROGRESS: 0,
  SETUP: 1,
  COMPLETED: 2,
};

export async function getStudentDecisionWorkspace(userId: string) {
  return cacheQuery(
    ["teams", "workspace", userId],
    async () => {
      const memberships = await prisma.teamMember.findMany({
        where: { userId },
        select: {
          joinedAt: true,
          team: {
            select: {
              id: true,
              name: true,
              hotelName: true,
              color: true,
              classId: true,
              hotelState: {
                select: {
                  cashBalance: true,
                  totalDebt: true,
                  brandReputation: true,
                  guestSatisfaction: true,
                  esgScore: true,
                },
              },
              class: {
                select: {
                  id: true,
                  name: true,
                  status: true,
                  currentRound: true,
                  maxRounds: true,
                  updatedAt: true,
                  semester: {
                    select: {
                      id: true,
                      name: true,
                      code: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (memberships.length === 0) {
        return null;
      }

      // The student area is still a single-workspace flow. Until a class switcher
      // lands, choose the most actionable class: in-progress first, then setup,
      // then the most recently updated completed class.
      const activeMembership = [...memberships].sort((left, right) => {
        const byStatus =
          classStatusPriority[left.team.class.status] -
          classStatusPriority[right.team.class.status];

        if (byStatus !== 0) {
          return byStatus;
        }

        const byRound = right.team.class.currentRound - left.team.class.currentRound;
        if (byRound !== 0) {
          return byRound;
        }

        const byClassUpdate =
          right.team.class.updatedAt.getTime() - left.team.class.updatedAt.getTime();
        if (byClassUpdate !== 0) {
          return byClassUpdate;
        }

        return right.joinedAt.getTime() - left.joinedAt.getTime();
      })[0];

      const activeRound =
        activeMembership.team.class.currentRound > 0
          ? await prisma.round.findUnique({
              where: {
                classId_roundNumber: {
                  classId: activeMembership.team.class.id,
                  roundNumber: activeMembership.team.class.currentRound,
                },
              },
              select: {
                id: true,
                roundNumber: true,
                status: true,
                seasonFactor: true,
                economyFactor: true,
                eventFactor: true,
                eventDescription: true,
                randomSeed: true,
                deadline: true,
                processedAt: true,
              },
            })
          : null;

      return {
        team: {
          id: activeMembership.team.id,
          name: activeMembership.team.name,
          hotelName: activeMembership.team.hotelName,
          color: activeMembership.team.color,
          classId: activeMembership.team.classId,
          hotelState: activeMembership.team.hotelState,
        },
        courseClass: {
          id: activeMembership.team.class.id,
          name: activeMembership.team.class.name,
          status: activeMembership.team.class.status,
          currentRound: activeMembership.team.class.currentRound,
          maxRounds: activeMembership.team.class.maxRounds,
          semester: activeMembership.team.class.semester,
        },
        round: activeRound,
      } satisfies StudentDecisionWorkspace;
    },
    {
      tags: [cacheTags.teamWorkspace(userId), cacheTags.classes, cacheTags.rounds],
    }
  );
}

export async function updateHotelState(
  teamId: string,
  data: Prisma.HotelStateUncheckedUpdateInput
) {
  return prisma.hotelState.update({
    where: { teamId },
    data,
  });
}
