import type { ApiSessionUser } from "@/lib/api/session";
import prisma from "@/lib/prisma";

// These helpers keep authz rules centralized across route handlers. Stage 2
// relies on path-based RBAC plus record ownership checks; later stages can
// evolve the policy here without rewriting every endpoint.

export async function getAccessibleSemesterRecord(
  user: ApiSessionUser,
  semesterId: string
) {
  if (user.role === "ADMIN") {
    return prisma.semester.findUnique({
      where: { id: semesterId },
      select: {
        id: true,
        creatorId: true,
      },
    });
  }

  if (user.role === "JUDGE") {
    return prisma.semester.findFirst({
      where: {
        id: semesterId,
        classes: {
          some: {
            rounds: {
              some: {
                competitionStage: {
                  competition: {
                    judgeAssignments: { some: { judgeId: user.id } },
                  },
                },
              },
            },
          },
        },
      },
      select: { id: true, creatorId: true },
    });
  }

  if (user.role === "TEACHER") {
    return prisma.semester.findFirst({
      where: {
        id: semesterId,
        creatorId: user.id,
      },
      select: {
        id: true,
        creatorId: true,
      },
    });
  }

  return null;
}

export async function getAccessibleClassRecord(
  user: ApiSessionUser,
  classId: string
) {
  if (user.role === "ADMIN") {
    return prisma.class.findUnique({
      where: { id: classId },
      select: {
        id: true,
        semesterId: true,
        currentRound: true,
        maxTeams: true,
        minTeamSize: true,
        maxTeamSize: true,
        _count: {
          select: {
            teams: true,
          },
        },
      },
    });
  }

  if (user.role === "JUDGE") {
    return prisma.class.findFirst({
      where: {
        id: classId,
        rounds: {
          some: {
            competitionStage: {
              competition: {
                judgeAssignments: { some: { judgeId: user.id } },
              },
            },
          },
        },
      },
      select: {
        id: true,
        semesterId: true,
        currentRound: true,
        maxTeams: true,
        minTeamSize: true,
        maxTeamSize: true,
        _count: { select: { teams: true } },
      },
    });
  }

  if (user.role === "TEACHER") {
    return prisma.class.findFirst({
      where: {
        id: classId,
        semester: {
          creatorId: user.id,
        },
      },
      select: {
        id: true,
        semesterId: true,
        currentRound: true,
        maxTeams: true,
        minTeamSize: true,
        maxTeamSize: true,
        _count: {
          select: {
            teams: true,
          },
        },
      },
    });
  }

  if (user.role === "STUDENT") {
    return prisma.class.findFirst({
      where: {
        id: classId,
        teamMembers: {
          some: {
            userId: user.id,
          },
        },
      },
      select: {
        id: true,
        semesterId: true,
        currentRound: true,
        maxTeams: true,
        minTeamSize: true,
        maxTeamSize: true,
        _count: {
          select: {
            teams: true,
          },
        },
      },
    });
  }

  return null;
}

export async function getAccessibleTeamRecord(
  user: ApiSessionUser,
  teamId: string
) {
  if (user.role === "ADMIN") {
    return prisma.team.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        classId: true,
      },
    });
  }

  if (user.role === "JUDGE") {
    return prisma.team.findFirst({
      where: {
        id: teamId,
        class: {
          rounds: {
            some: {
              competitionStage: {
                competition: {
                  judgeAssignments: { some: { judgeId: user.id } },
                },
              },
            },
          },
        },
      },
      select: { id: true, classId: true },
    });
  }

  if (user.role === "TEACHER") {
    return prisma.team.findFirst({
      where: {
        id: teamId,
        class: {
          semester: {
            creatorId: user.id,
          },
        },
      },
      select: {
        id: true,
        classId: true,
      },
    });
  }

  if (user.role === "STUDENT") {
    return prisma.team.findFirst({
      where: {
        id: teamId,
        members: {
          some: {
            userId: user.id,
          },
        },
      },
      select: {
        id: true,
        classId: true,
      },
    });
  }

  return null;
}

export async function getAccessibleRoundRecord(
  user: ApiSessionUser,
  roundId: string
) {
  if (user.role === "ADMIN") {
    return prisma.round.findUnique({
      where: { id: roundId },
      select: {
        id: true,
        classId: true,
        roundNumber: true,
        status: true,
      },
    });
  }

  if (user.role === "JUDGE") {
    return prisma.round.findFirst({
      where: {
        id: roundId,
        competitionStage: {
          competition: {
            judgeAssignments: { some: { judgeId: user.id } },
          },
        },
      },
      select: {
        id: true,
        classId: true,
        roundNumber: true,
        status: true,
      },
    });
  }

  if (user.role === "TEACHER") {
    return prisma.round.findFirst({
      where: {
        id: roundId,
        class: {
          semester: {
            creatorId: user.id,
          },
        },
      },
      select: {
        id: true,
        classId: true,
        roundNumber: true,
        status: true,
      },
    });
  }

  if (user.role === "STUDENT") {
    return prisma.round.findFirst({
      where: {
        id: roundId,
        class: {
          teamMembers: {
            some: {
              userId: user.id,
            },
          },
        },
      },
      select: {
        id: true,
        classId: true,
        roundNumber: true,
        status: true,
      },
    });
  }

  return null;
}
