import { Prisma, SemesterStatus } from "@prisma/client";
import { cacheQuery, cacheTags } from "@/lib/cache";
import prisma from "@/lib/prisma";

export type CreateSemesterInput = {
  creatorId: string;
  name: string;
  code: string;
  description?: string;
  startDate?: Date;
  endDate?: Date;
};

export async function createSemester(input: CreateSemesterInput) {
  const data: Prisma.SemesterCreateInput = {
    name: input.name,
    code: input.code,
    description: input.description,
    startDate: input.startDate,
    endDate: input.endDate,
    status: SemesterStatus.DRAFT,
    creator: {
      connect: { id: input.creatorId },
    },
  };

  return prisma.semester.create({ data });
}

export async function listSemestersForTeacher(teacherId: string) {
  return cacheQuery(
    ["semesters", "teacher", teacherId],
    () =>
      prisma.semester.findMany({
        where: { creatorId: teacherId },
        include: {
          _count: {
            select: { classes: true },
          },
          classes: {
            select: {
              id: true,
              name: true,
              status: true,
              currentRound: true,
              maxRounds: true,
            },
          },
        },
        orderBy: [{ status: "asc" }, { startDate: "desc" }],
      }),
    {
      tags: [cacheTags.semesters, cacheTags.teacherSemesters(teacherId)],
    }
  );
}

export async function listAllSemesters() {
  return cacheQuery(
    ["semesters", "all"],
    () =>
      prisma.semester.findMany({
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          _count: {
            select: { classes: true },
          },
          classes: {
            select: {
              id: true,
              name: true,
              status: true,
              currentRound: true,
              maxRounds: true,
            },
          },
        },
        orderBy: [{ status: "asc" }, { startDate: "desc" }, { createdAt: "desc" }],
      }),
    {
      tags: [cacheTags.semesters],
    }
  );
}

export async function getSemesterById(semesterId: string) {
  return cacheQuery(
    ["semesters", "detail", semesterId],
    () =>
      prisma.semester.findUnique({
        where: { id: semesterId },
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          classes: {
            include: {
              _count: {
                select: { teams: true, rounds: true },
              },
            },
          },
        },
      }),
    {
      tags: [cacheTags.semesters, cacheTags.semester(semesterId), cacheTags.classes],
    }
  );
}
