import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/session", () => ({
  requireApiSession: vi.fn(),
  requireApiRoles: vi.fn(),
}));

vi.mock("@/lib/auth/passwords", () => ({
  hashPassword: vi.fn(),
}));

vi.mock("@/lib/dal/users", () => ({
  createUser: vi.fn(),
  getUserAdminSummaryById: vi.fn(),
  getUserByStudentId: vi.fn(),
  getUserForCredentials: vi.fn(),
  listPlatformUsers: vi.fn(),
  updateUserRole: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  recordAuditLog: vi.fn(),
}));

import { GET, PATCH, POST } from "./route";
import { recordAuditLog } from "@/lib/audit";
import { requireApiRoles, requireApiSession } from "@/lib/api/session";
import { hashPassword } from "@/lib/auth/passwords";
import {
  createUser,
  getUserAdminSummaryById,
  getUserByStudentId,
  getUserForCredentials,
  listPlatformUsers,
  updateUserRole,
} from "@/lib/dal/users";

const mockedRequireApiSession = vi.mocked(requireApiSession);
const mockedRequireApiRoles = vi.mocked(requireApiRoles);
const mockedHashPassword = vi.mocked(hashPassword);
const mockedCreateUser = vi.mocked(createUser);
const mockedGetUserAdminSummaryById = vi.mocked(getUserAdminSummaryById);
const mockedGetUserByStudentId = vi.mocked(getUserByStudentId);
const mockedGetUserForCredentials = vi.mocked(getUserForCredentials);
const mockedListPlatformUsers = vi.mocked(listPlatformUsers);
const mockedUpdateUserRole = vi.mocked(updateUserRole);
const mockedRecordAuditLog = vi.mocked(recordAuditLog);

describe("/api/users", () => {
  beforeEach(() => {
    mockedRequireApiSession.mockResolvedValue({
      session: {
        user: {
          id: "admin-1",
          role: "ADMIN",
        },
      },
    } as Awaited<ReturnType<typeof requireApiSession>>);
    mockedRequireApiRoles.mockReturnValue(null);
  });

  it("lists platform users with validated filters", async () => {
    mockedListPlatformUsers.mockResolvedValue([
      {
        id: "teacher-1",
        name: "Prof. Chen",
        email: "teacher@hotelsim.example",
        role: "TEACHER",
        studentId: null,
        locale: "ZH_CN",
        emailVerified: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: {
          teamMembers: 0,
          createdSemesters: 2,
        },
        teamMembers: [],
        createdSemesters: [],
      },
    ] as Awaited<ReturnType<typeof listPlatformUsers>>);

    const response = (await GET(
      new NextRequest("http://localhost/api/users?role=TEACHER&search=chen")
    ))!;

    expect(response.status).toBe(200);
    expect(mockedListPlatformUsers).toHaveBeenCalledWith({
      role: "TEACHER",
      search: "chen",
    });
  });

  it("creates a credential user after hashing the supplied password", async () => {
    mockedGetUserForCredentials.mockResolvedValue(null);
    mockedGetUserByStudentId.mockResolvedValue(null);
    mockedHashPassword.mockResolvedValue("hashed-password");
    mockedCreateUser.mockResolvedValue({
      id: "student-1",
      name: "Student Demo",
      email: "student.demo@hotelsim.example",
      role: "STUDENT",
    } as Awaited<ReturnType<typeof createUser>>);

    const response = (await POST(
      new NextRequest("http://localhost/api/users", {
        method: "POST",
        body: JSON.stringify({
          name: "Student Demo",
          email: "student.demo@hotelsim.example",
          password: "HotelSim123!",
          role: "STUDENT",
          studentId: "2026HS99",
        }),
      })
    ))!;

    expect(response.status).toBe(201);
    expect(mockedHashPassword).toHaveBeenCalledWith("HotelSim123!");
    expect(mockedCreateUser).toHaveBeenCalledWith({
      name: "Student Demo",
      email: "student.demo@hotelsim.example",
      passwordHash: "hashed-password",
      role: "STUDENT",
      studentId: "2026HS99",
      emailVerified: expect.any(Date),
    });
    expect(mockedRecordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "user.create",
        entityType: "user",
        entityId: "student-1",
      })
    );
  });

  it("blocks self-demotion so admins cannot lock themselves out", async () => {
    mockedGetUserAdminSummaryById.mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
    } as Awaited<ReturnType<typeof getUserAdminSummaryById>>);

    const response = (await PATCH(
      new NextRequest("http://localhost/api/users", {
        method: "PATCH",
        body: JSON.stringify({
          userId: "admin-1",
          role: "TEACHER",
        }),
      })
    ))!;

    expect(response.status).toBe(400);
    expect(mockedUpdateUserRole).not.toHaveBeenCalled();
  });

  it("passes through auth failures from the session layer", async () => {
    mockedRequireApiSession.mockResolvedValue({
      response: NextResponse.json(
        {
          status: "error",
          message: "Authentication is required.",
        },
        { status: 401 }
      ),
    } as Awaited<ReturnType<typeof requireApiSession>>);

    const response = (await GET(
      new NextRequest("http://localhost/api/users")
    ))!;

    expect(response.status).toBe(401);
  });
});
