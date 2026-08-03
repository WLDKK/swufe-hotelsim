import { Prisma, UserRole } from "@prisma/client";
import { cacheQuery, cacheTags } from "@/lib/cache";
import prisma from "@/lib/prisma";

export type CreateUserInput = {
  name?: string;
  email: string;
  passwordHash?: string;
  role?: UserRole;
  studentId?: string;
  image?: string;
  emailVerified?: Date | null;
};

export type CreateStudentCredentialUserInput = {
  name: string;
  email: string;
  studentId?: string;
  passwordHash: string;
  emailVerified?: Date | null;
};

export type ListPlatformUsersInput = {
  role?: UserRole;
  search?: string;
};

// User DAL stays intentionally small at this stage: auth flows in stage 2 can
// build on these methods without duplicating low-level Prisma queries.
export async function getUserById(userId: string) {
  return cacheQuery(
    ["users", "detail", userId],
    () =>
      prisma.user.findUnique({
        where: { id: userId },
        include: {
          teamMembers: {
            include: {
              team: {
                include: {
                  class: true,
                },
              },
            },
          },
        },
      }),
    {
      tags: [cacheTags.users, cacheTags.user(userId)],
    }
  );
}

export async function getUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
  });
}

// Stage 2 credentials auth needs a compact lookup shape that includes the
// password hash and role metadata without pulling unrelated relations.
export async function getUserForCredentials(email: string) {
  return prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      passwordHash: true,
      role: true,
      studentId: true,
      locale: true,
      emailVerified: true,
    },
  });
}

export async function getUserByStudentId(studentId: string) {
  // Registration and later roster flows both need a direct uniqueness check on
  // student IDs without loading the heavier auth/session shape.
  return prisma.user.findUnique({
    where: { studentId },
  });
}

export async function listUsersByRole(role: UserRole) {
  return cacheQuery(
    ["users", "role", role],
    () =>
      prisma.user.findMany({
        where: { role },
        orderBy: {
          createdAt: "desc",
        },
      }),
    {
      tags: [cacheTags.users],
    }
  );
}

export async function createUser(input: CreateUserInput) {
  const data: Prisma.UserCreateInput = {
    name: input.name,
    email: input.email,
    passwordHash: input.passwordHash,
    role: input.role ?? UserRole.STUDENT,
    studentId: input.studentId,
    image: input.image,
    emailVerified: input.emailVerified ?? undefined,
  };

  return prisma.user.create({ data });
}

export async function createStudentCredentialUser(
  input: CreateStudentCredentialUserInput
) {
  // Stage 2 keeps self-service signup restricted to students. Teacher/admin
  // creation should continue to happen through seed data or future admin tools.
  return prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      studentId: input.studentId,
      passwordHash: input.passwordHash,
      role: UserRole.STUDENT,
      emailVerified: input.emailVerified ?? undefined,
    },
  });
}

export async function listPlatformUsers(input: ListPlatformUsersInput = {}) {
  const search = input.search?.trim();

  return cacheQuery(
    ["users", "platform", input.role ?? "all", search ?? "all"],
    () =>
      prisma.user.findMany({
        where: {
          ...(input.role ? { role: input.role } : {}),
          ...(search
            ? {
                OR: [
                  {
                    name: {
                      contains: search,
                      mode: "insensitive",
                    },
                  },
                  {
                    email: {
                      contains: search,
                      mode: "insensitive",
                    },
                  },
                  {
                    studentId: {
                      contains: search,
                      mode: "insensitive",
                    },
                  },
                ],
              }
            : {}),
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          studentId: true,
          locale: true,
          emailVerified: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              teamMembers: true,
              createdSemesters: true,
            },
          },
          // Keep list payloads compact while still giving admin pages enough
          // context to understand a user's current teaching/roster footprint.
          teamMembers: {
            orderBy: {
              joinedAt: "desc",
            },
            take: 3,
            select: {
              id: true,
              role: true,
              class: {
                select: {
                  id: true,
                  name: true,
                },
              },
              team: {
                select: {
                  id: true,
                  name: true,
                  hotelName: true,
                },
              },
            },
          },
          createdSemesters: {
            orderBy: {
              createdAt: "desc",
            },
            take: 3,
            select: {
              id: true,
              name: true,
              code: true,
              status: true,
            },
          },
        },
        orderBy: [{ role: "asc" }, { createdAt: "desc" }],
      }),
    {
      tags: [cacheTags.users],
    }
  );
}

export async function getUserAdminSummaryById(userId: string) {
  return cacheQuery(
    ["users", "admin-summary", userId],
    () =>
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          studentId: true,
          emailVerified: true,
        },
      }),
    {
      tags: [cacheTags.users, cacheTags.user(userId)],
    }
  );
}

export async function updateUserRole(userId: string, role: UserRole) {
  return prisma.user.update({
    where: { id: userId },
    data: { role },
  });
}

export async function updateUserPasswordHash(userId: string, passwordHash: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });
}

export async function markUserEmailVerified(userId: string, emailVerified = new Date()) {
  return prisma.user.update({
    where: { id: userId },
    data: { emailVerified },
  });
}
