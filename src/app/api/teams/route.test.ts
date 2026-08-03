import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/access", () => ({
  getAccessibleClassRecord: vi.fn(),
  getAccessibleTeamRecord: vi.fn(),
}));

vi.mock("@/lib/api/session", () => ({
  requireApiSession: vi.fn(),
  requireApiRoles: vi.fn(),
}));

vi.mock("@/lib/dal/teams", () => ({
  addTeamMember: vi.fn(),
  createTeam: vi.fn(),
  deleteTeamById: vi.fn(),
  getTeamById: vi.fn(),
  getTeamManagementById: vi.fn(),
  getUserTeamInClass: vi.fn(),
  listTeamsForClass: vi.fn(),
  moveTeamMemberToTeam: vi.fn(),
  removeTeamMember: vi.fn(),
  setTeamLeader: vi.fn(),
  updateTeamMetadata: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    teamMember: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/audit", () => ({
  recordAuditLog: vi.fn(),
}));

import { DELETE, PATCH, POST } from "./route";
import { recordAuditLog } from "@/lib/audit";
import { getAccessibleClassRecord, getAccessibleTeamRecord } from "@/lib/api/access";
import { requireApiRoles, requireApiSession } from "@/lib/api/session";
import {
  addTeamMember,
  createTeam,
  deleteTeamById,
  getTeamById,
  getTeamManagementById,
  moveTeamMemberToTeam,
  removeTeamMember,
} from "@/lib/dal/teams";
import prisma from "@/lib/prisma";

const mockedRequireApiSession = vi.mocked(requireApiSession);
const mockedRequireApiRoles = vi.mocked(requireApiRoles);
const mockedGetAccessibleClassRecord = vi.mocked(getAccessibleClassRecord);
const mockedGetAccessibleTeamRecord = vi.mocked(getAccessibleTeamRecord);
const mockedAddTeamMember = vi.mocked(addTeamMember);
const mockedCreateTeam = vi.mocked(createTeam);
const mockedDeleteTeamById = vi.mocked(deleteTeamById);
const mockedGetTeamById = vi.mocked(getTeamById);
const mockedGetTeamManagementById = vi.mocked(getTeamManagementById);
const mockedMoveTeamMemberToTeam = vi.mocked(moveTeamMemberToTeam);
const mockedRemoveTeamMember = vi.mocked(removeTeamMember);
const mockedPrismaUserFindMany = vi.mocked(prisma.user.findMany);
const mockedPrismaUserFindUnique = vi.mocked(prisma.user.findUnique);
const mockedPrismaTeamMemberFindMany = vi.mocked(prisma.teamMember.findMany);
const mockedPrismaTeamMemberFindUnique = vi.mocked(prisma.teamMember.findUnique);
const mockedRecordAuditLog = vi.mocked(recordAuditLog);

describe("/api/teams", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("blocks creating a new team once the class has already started rounds", async () => {
    mockedGetAccessibleClassRecord.mockResolvedValue({
      id: "class-1",
      semesterId: "semester-1",
      currentRound: 1,
      maxTeams: 4,
      minTeamSize: 3,
      maxTeamSize: 6,
      _count: {
        teams: 2,
      },
    } as Awaited<ReturnType<typeof getAccessibleClassRecord>>);

    const response = (await POST(
      new NextRequest("http://localhost/api/teams", {
        method: "POST",
        body: JSON.stringify({
          classId: "class-1",
          name: "Late Team",
          hotelName: "Late Hotel",
          color: "#123456",
          leaderUserId: "student-9",
          memberUserIds: ["student-10", "student-11"],
        }),
      })
    ))!;

    expect(response.status).toBe(409);
    expect(mockedPrismaUserFindMany).not.toHaveBeenCalled();
    expect(mockedPrismaTeamMemberFindMany).not.toHaveBeenCalled();
    expect(mockedCreateTeam).not.toHaveBeenCalled();

    await expect(response.json()).resolves.toMatchObject({
      status: "error",
      message:
        "Teams can only be created before the class starts processing rounds.",
    });
  });

  it("adds a student to a team after validating roster conflicts", async () => {
    // This is the exact branch that was left half-finished during the earlier
    // interruption, so keep one focused regression test on the happy path.
    mockedGetAccessibleTeamRecord.mockResolvedValue({
      id: "team-1",
      classId: "class-1",
    } as Awaited<ReturnType<typeof getAccessibleTeamRecord>>);
    mockedGetTeamManagementById.mockResolvedValue({
      id: "team-1",
      class: {
        id: "class-1",
        currentRound: 0,
        minTeamSize: 3,
        maxTeamSize: 6,
      },
      members: [
        {
          id: "member-1",
          userId: "student-1",
          role: "LEADER",
          user: {
            id: "student-1",
            name: "Leader",
            email: "leader@hotelsim.example",
            studentId: "2026001",
            role: "STUDENT",
          },
        },
      ],
      _count: {
        decisions: 0,
        results: 0,
      },
    } as Awaited<ReturnType<typeof getTeamManagementById>>);
    mockedPrismaUserFindUnique.mockResolvedValue({
      id: "student-2",
      role: "STUDENT",
    } as never);
    mockedPrismaTeamMemberFindUnique.mockResolvedValue(null);
    mockedAddTeamMember.mockResolvedValue({
      id: "member-2",
    } as Awaited<ReturnType<typeof addTeamMember>>);
    mockedGetTeamById.mockResolvedValue({
      id: "team-1",
      name: "Team Alpha",
    } as Awaited<ReturnType<typeof getTeamById>>);

    const response = (await PATCH(
      new NextRequest("http://localhost/api/teams", {
        method: "PATCH",
        body: JSON.stringify({
          action: "addMember",
          teamId: "team-1",
          userId: "student-2",
        }),
      })
    ))!;

    expect(response.status).toBe(200);
    expect(mockedAddTeamMember).toHaveBeenCalledWith("team-1", "student-2");
    expect(mockedRecordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "team.member.add",
        entityType: "team",
        entityId: "team-1",
      })
    );

    await expect(response.json()).resolves.toMatchObject({
      status: "ok",
      data: {
        team: {
          id: "team-1",
        },
      },
    });
  });

  it("rejects removing the current leader before a replacement is assigned", async () => {
    mockedGetAccessibleTeamRecord.mockResolvedValue({
      id: "team-1",
      classId: "class-1",
    } as Awaited<ReturnType<typeof getAccessibleTeamRecord>>);
    mockedGetTeamManagementById.mockResolvedValue({
      id: "team-1",
      class: {
        id: "class-1",
        currentRound: 0,
        minTeamSize: 3,
        maxTeamSize: 6,
      },
      members: [
        {
          id: "member-1",
          userId: "student-1",
          role: "LEADER",
          user: {
            id: "student-1",
            name: "Leader",
            email: "leader@hotelsim.example",
            studentId: "2026001",
            role: "STUDENT",
          },
        },
      ],
      _count: {
        decisions: 0,
        results: 0,
      },
    } as Awaited<ReturnType<typeof getTeamManagementById>>);

    const response = (await PATCH(
      new NextRequest("http://localhost/api/teams", {
        method: "PATCH",
        body: JSON.stringify({
          action: "removeMember",
          teamId: "team-1",
          userId: "student-1",
        }),
      })
    ))!;

    expect(response.status).toBe(400);
    expect(mockedRemoveTeamMember).not.toHaveBeenCalled();
    expect(mockedRecordAuditLog).not.toHaveBeenCalled();
  });

  it("rejects cross-class member moves before mutating team membership", async () => {
    // Move operations are only legal inside one class because TeamMember also
    // carries classId for uniqueness and later roster/reporting queries.
    mockedGetAccessibleTeamRecord
      .mockResolvedValueOnce({
        id: "team-1",
        classId: "class-1",
      } as Awaited<ReturnType<typeof getAccessibleTeamRecord>>)
      .mockResolvedValueOnce({
        id: "team-2",
        classId: "class-2",
      } as Awaited<ReturnType<typeof getAccessibleTeamRecord>>);
    mockedGetTeamManagementById
      .mockResolvedValueOnce({
        id: "team-1",
        class: {
          id: "class-1",
          currentRound: 0,
          minTeamSize: 3,
          maxTeamSize: 6,
        },
        members: [
          {
            id: "member-2",
            userId: "student-2",
            role: "MEMBER",
            user: {
              id: "student-2",
              name: "Student Two",
              email: "student02@hotelsim.example",
              studentId: "2026002",
              role: "STUDENT",
            },
          },
        ],
        _count: {
          decisions: 0,
          results: 0,
        },
      } as Awaited<ReturnType<typeof getTeamManagementById>>)
      .mockResolvedValueOnce({
        id: "team-2",
        name: "Team Beta",
        classId: "class-2",
        hotelName: "Beta Hotel",
        color: "#1D4ED8",
        createdAt: new Date(),
        updatedAt: new Date(),
        class: {
          id: "class-2",
          currentRound: 0,
          minTeamSize: 3,
          maxTeamSize: 6,
        },
        members: [],
        _count: {
          decisions: 0,
          results: 0,
        },
      } as Awaited<ReturnType<typeof getTeamManagementById>>);

    const response = (await PATCH(
      new NextRequest("http://localhost/api/teams", {
        method: "PATCH",
        body: JSON.stringify({
          action: "moveMember",
          sourceTeamId: "team-1",
          targetTeamId: "team-2",
          userId: "student-2",
        }),
      })
    ))!;

    expect(response.status).toBe(400);
    expect(mockedMoveTeamMemberToTeam).not.toHaveBeenCalled();
  });

  it("blocks deleting teams once the class already has round history", async () => {
    mockedGetAccessibleTeamRecord.mockResolvedValue({
      id: "team-1",
      classId: "class-1",
    } as Awaited<ReturnType<typeof getAccessibleTeamRecord>>);
    mockedGetTeamManagementById.mockResolvedValue({
      id: "team-1",
      name: "Team Alpha",
      classId: "class-1",
      hotelName: "Alpha Hotel",
      color: "#8B1A1A",
      createdAt: new Date(),
      updatedAt: new Date(),
      class: {
        id: "class-1",
        currentRound: 1,
        minTeamSize: 3,
        maxTeamSize: 6,
      },
      members: [],
      _count: {
        decisions: 1,
        results: 0,
      },
    } as Awaited<ReturnType<typeof getTeamManagementById>>);

    const response = (await DELETE(
      new NextRequest("http://localhost/api/teams?teamId=team-1", {
        method: "DELETE",
      })
    ))!;

    expect(response.status).toBe(409);
    expect(mockedDeleteTeamById).not.toHaveBeenCalled();
  });
});
