import { ClassStatus, Prisma } from "@prisma/client";
import { cacheQuery, cacheTags } from "@/lib/cache";
import prisma from "@/lib/prisma";
import { DEFAULT_SIM_PARAMETERS } from "@/lib/constants";

export type CreateClassInput = {
  semesterId: string;
  name: string;
  joinCode?: string;
  maxTeams?: number;
  minTeamSize?: number;
  maxTeamSize?: number;
  totalRooms?: number;
  maxRounds?: number;
  simParameters?: Prisma.InputJsonValue;
};

const classListInclude = {
  semester: {
    select: {
      id: true,
      name: true,
      code: true,
      status: true,
      creatorId: true,
      creator: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  },
  _count: {
    select: {
      teams: true,
      rounds: true,
      teamMembers: true,
    },
  },
} satisfies Prisma.ClassInclude;

// Class DAL is the handoff boundary between teacher/admin workflows and the
// future simulation engine. Keep includes here richer than page-level queries
// so API handlers can reuse them without duplicating join logic.
export async function createClass(input: CreateClassInput) {
  return prisma.class.create({
    data: {
      semester: {
        connect: { id: input.semesterId },
      },
      name: input.name,
      joinCode: input.joinCode,
      maxTeams: input.maxTeams ?? 8,
      minTeamSize: input.minTeamSize ?? 3,
      maxTeamSize: input.maxTeamSize ?? 6,
      totalRooms: input.totalRooms ?? 500,
      maxRounds: input.maxRounds ?? 12,
      status: ClassStatus.SETUP,
      // Default to the shared parameter baseline so newly created classes are
      // immediately compatible with later simulation and validation layers.
      simParameters: input.simParameters ?? DEFAULT_SIM_PARAMETERS,
    },
  });
}

export async function updateClassSimulationParameters(
  classId: string,
  simParameters: Prisma.InputJsonObject
) {
  const classRecord = await prisma.class.findUnique({
    where: { id: classId },
    select: {
      simParameters: true,
    },
  });

  const currentParameters =
    classRecord?.simParameters && typeof classRecord.simParameters === "object"
      ? (classRecord.simParameters as Prisma.InputJsonObject)
      : {};

  return prisma.class.update({
    where: { id: classId },
    data: {
      simParameters: {
        ...currentParameters,
        ...simParameters,
      },
    },
    include: {
      semester: {
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      },
    },
  });
}

export async function getClassById(classId: string) {
  return cacheQuery(
    ["classes", "detail", classId],
    () =>
      prisma.class.findUnique({
        where: { id: classId },
        include: {
          semester: {
            include: {
              creator: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                },
              },
            },
          },
          teams: {
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
          },
          // Round ordering is important because later teacher controls and engine
          // jobs will assume the array is already chronological.
          rounds: {
            orderBy: {
              roundNumber: "asc",
            },
          },
        },
      }),
    {
      tags: [
        cacheTags.classes,
        cacheTags.class(classId),
        cacheTags.classTeams(classId),
        cacheTags.classRounds(classId),
        cacheTags.classResults(classId),
      ],
    }
  );
}

export async function getClassByJoinCode(joinCode: string) {
  return cacheQuery(
    ["classes", "join-code", joinCode],
    () =>
      prisma.class.findUnique({
        where: { joinCode },
        include: {
          semester: {
            include: {
              creator: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                },
              },
            },
          },
          _count: {
            select: { teams: true },
          },
        },
      }),
    {
      tags: [cacheTags.classes, cacheTags.classJoinCode(joinCode)],
    }
  );
}

export async function listClassesForTeacher(teacherId: string) {
  return cacheQuery(
    ["classes", "teacher", teacherId],
    () =>
      prisma.class.findMany({
        where: {
          semester: {
            creatorId: teacherId,
          },
        },
        include: classListInclude,
        orderBy: [{ createdAt: "desc" }],
      }),
    {
      tags: [cacheTags.classes, cacheTags.teacherClasses(teacherId)],
    }
  );
}

export async function listAllClasses() {
  return cacheQuery(
    ["classes", "all"],
    () =>
      prisma.class.findMany({
        include: classListInclude,
        orderBy: [{ createdAt: "desc" }],
      }),
    {
      tags: [cacheTags.classes],
    }
  );
}

export async function listClassesForJudge(judgeId: string) {
  return cacheQuery(
    ["classes", "judge", judgeId],
    () =>
      prisma.class.findMany({
        where: {
          rounds: {
            some: {
              competitionStage: {
                competition: {
                  judgeAssignments: { some: { judgeId } },
                },
              },
            },
          },
        },
        include: classListInclude,
        orderBy: [{ createdAt: "desc" }],
      }),
    { tags: [cacheTags.classes, cacheTags.users, cacheTags.competitions] }
  );
}

export async function listClassesForSemester(semesterId: string) {
  return cacheQuery(
    ["classes", "semester", semesterId],
    () =>
      prisma.class.findMany({
        where: { semesterId },
        // Keep the filtered class list on the same shape as the unfiltered
        // teacher/admin list endpoint so UI tables can switch between them without
        // defensive branching for missing semester or team-member metadata.
        include: classListInclude,
        orderBy: {
          createdAt: "asc",
        },
      }),
    {
      tags: [cacheTags.classes, cacheTags.semester(semesterId)],
    }
  );
}
