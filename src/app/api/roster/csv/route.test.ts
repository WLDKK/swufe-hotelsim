import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/access", () => ({
  getAccessibleClassRecord: vi.fn(),
}));

vi.mock("@/lib/api/session", () => ({
  requireApiSession: vi.fn(),
  requireApiRoles: vi.fn(),
}));

vi.mock("@/lib/dal/teams", () => ({
  getClassRosterImportState: vi.fn(),
  listTeamsForClass: vi.fn(),
  replaceClassRoster: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    user: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/audit", () => ({
  recordAuditLog: vi.fn(),
}));

import { GET, POST } from "./route";
import { recordAuditLog } from "@/lib/audit";
import { getAccessibleClassRecord } from "@/lib/api/access";
import { requireApiRoles, requireApiSession } from "@/lib/api/session";
import {
  getClassRosterImportState,
  replaceClassRoster,
} from "@/lib/dal/teams";
import prisma from "@/lib/prisma";

const mockedRequireApiSession = vi.mocked(requireApiSession);
const mockedRequireApiRoles = vi.mocked(requireApiRoles);
const mockedGetAccessibleClassRecord = vi.mocked(getAccessibleClassRecord);
const mockedGetClassRosterImportState = vi.mocked(getClassRosterImportState);
const mockedReplaceClassRoster = vi.mocked(replaceClassRoster);
const mockedPrismaUserFindMany = vi.mocked(prisma.user.findMany);
const mockedRecordAuditLog = vi.mocked(recordAuditLog);

const validCsv = [
  "team_name,hotel_name,team_color,student_email,student_id,student_name,team_role",
  "Team Atlas,Atlas Grand Hotel,#8B1A1A,student01@hotelsim.example,2026001,Student One,LEADER",
  "Team Atlas,Atlas Grand Hotel,#8B1A1A,student02@hotelsim.example,2026002,Student Two,MEMBER",
].join("\r\n");

describe("/api/roster/csv", () => {
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

  it("returns the template csv for admin downloads", async () => {
    const response = (await GET(
      new NextRequest("http://localhost/api/roster/csv?template=true")
    ))!;

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    await expect(response.text()).resolves.toContain("team_name,hotel_name");
  });

  it("validates a csv roster payload and returns an import preview", async () => {
    mockedGetAccessibleClassRecord.mockResolvedValue({
      id: "class-1",
      currentRound: 0,
      maxTeams: 8,
      minTeamSize: 1,
      maxTeamSize: 6,
      _count: {
        teams: 0,
      },
    } as Awaited<ReturnType<typeof getAccessibleClassRecord>>);
    mockedPrismaUserFindMany.mockResolvedValue([
      {
        id: "student-1",
        email: "student01@hotelsim.example",
        studentId: "2026001",
        role: "STUDENT",
        name: "Student One",
      },
      {
        id: "student-2",
        email: "student02@hotelsim.example",
        studentId: "2026002",
        role: "STUDENT",
        name: "Student Two",
      },
    ] as never);

    const response = (await POST(
      new NextRequest("http://localhost/api/roster/csv", {
        method: "POST",
        body: JSON.stringify({
          classId: "class-1",
          csvText: validCsv,
          mode: "validate",
        }),
      })
    ))!;

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "ok",
      data: {
        mode: "validate",
        summary: {
          teams: 1,
          members: 2,
          leaders: 1,
        },
      },
    });
    expect(mockedRecordAuditLog).not.toHaveBeenCalled();
  });

  it("blocks destructive apply mode once a class has already started", async () => {
    mockedGetAccessibleClassRecord.mockResolvedValue({
      id: "class-1",
      currentRound: 1,
      maxTeams: 8,
      minTeamSize: 1,
      maxTeamSize: 6,
      _count: {
        teams: 1,
      },
    } as Awaited<ReturnType<typeof getAccessibleClassRecord>>);
    mockedPrismaUserFindMany.mockResolvedValue([
      {
        id: "student-1",
        email: "student01@hotelsim.example",
        studentId: "2026001",
        role: "STUDENT",
        name: "Student One",
      },
      {
        id: "student-2",
        email: "student02@hotelsim.example",
        studentId: "2026002",
        role: "STUDENT",
        name: "Student Two",
      },
    ] as never);
    mockedGetClassRosterImportState.mockResolvedValue({
      id: "class-1",
      currentRound: 1,
      teams: [
        {
          id: "team-1",
          _count: {
            decisions: 1,
            results: 0,
          },
        },
      ],
    } as Awaited<ReturnType<typeof getClassRosterImportState>>);

    const response = (await POST(
      new NextRequest("http://localhost/api/roster/csv", {
        method: "POST",
        body: JSON.stringify({
          classId: "class-1",
          csvText: validCsv,
          mode: "apply",
        }),
      })
    ))!;

    expect(response.status).toBe(409);
    expect(mockedReplaceClassRoster).not.toHaveBeenCalled();
    expect(mockedRecordAuditLog).not.toHaveBeenCalled();
  });
});
