import { ClassStatus, RoundStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/access", () => ({
  getAccessibleClassRecord: vi.fn(),
}));

vi.mock("@/lib/api/session", () => ({
  requireApiSession: vi.fn(),
  requireApiRoles: vi.fn(),
}));

vi.mock("@/lib/dal/classes", () => ({
  getClassById: vi.fn(),
}));

vi.mock("@/lib/dal/rounds", () => ({
  createAndActivateRound: vi.fn(),
  getRoundById: vi.fn(),
  getRoundByClassAndNumber: vi.fn(),
  listRoundsForClass: vi.fn(),
  updateRoundEnvironment: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  recordAuditLog: vi.fn(),
}));

import { recordAuditLog } from "@/lib/audit";
import { getAccessibleClassRecord } from "@/lib/api/access";
import { requireApiRoles, requireApiSession } from "@/lib/api/session";
import { getClassById } from "@/lib/dal/classes";
import {
  createAndActivateRound,
  getRoundById,
  getRoundByClassAndNumber,
  listRoundsForClass,
  updateRoundEnvironment,
} from "@/lib/dal/rounds";
import { GET, PATCH, POST } from "./route";

const mockedRequireApiSession = vi.mocked(requireApiSession);
const mockedRequireApiRoles = vi.mocked(requireApiRoles);
const mockedGetAccessibleClassRecord = vi.mocked(getAccessibleClassRecord);
const mockedGetClassById = vi.mocked(getClassById);
const mockedCreateAndActivateRound = vi.mocked(createAndActivateRound);
const mockedGetRoundById = vi.mocked(getRoundById);
const mockedGetRoundByClassAndNumber = vi.mocked(getRoundByClassAndNumber);
const mockedListRoundsForClass = vi.mocked(listRoundsForClass);
const mockedUpdateRoundEnvironment = vi.mocked(updateRoundEnvironment);
const mockedRecordAuditLog = vi.mocked(recordAuditLog);

describe("/api/rounds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequireApiSession.mockResolvedValue({
      session: {
        user: {
          id: "teacher-1",
          role: "TEACHER",
        },
      },
    } as Awaited<ReturnType<typeof requireApiSession>>);
    mockedRequireApiRoles.mockReturnValue(null);
  });

  it("lists the round timeline for an accessible class", async () => {
    mockedGetAccessibleClassRecord.mockResolvedValue({
      id: "class-1",
      currentRound: 2,
    } as Awaited<ReturnType<typeof getAccessibleClassRecord>>);
    mockedListRoundsForClass.mockResolvedValue([
      {
        id: "round-1",
        classId: "class-1",
        roundNumber: 1,
        status: RoundStatus.COMPLETED,
        _count: {
          decisions: 4,
          results: 4,
        },
      },
      {
        id: "round-2",
        classId: "class-1",
        roundNumber: 2,
        status: RoundStatus.PENDING,
        _count: {
          decisions: 2,
          results: 0,
        },
      },
    ] as Awaited<ReturnType<typeof listRoundsForClass>>);

    const response = (await GET(
      new NextRequest("http://localhost/api/rounds?classId=class-1")
    ))!;

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "ok",
      data: {
        classId: "class-1",
        currentRoundNumber: 2,
        currentRound: {
          id: "round-2",
        },
        rounds: [
          { id: "round-1" },
          { id: "round-2" },
        ],
      },
    });
  });

  it("creates and activates round 1 for a setup class", async () => {
    mockedGetAccessibleClassRecord.mockResolvedValue({
      id: "class-1",
      currentRound: 0,
    } as Awaited<ReturnType<typeof getAccessibleClassRecord>>);
    mockedGetClassById.mockResolvedValue({
      id: "class-1",
      status: ClassStatus.SETUP,
      currentRound: 0,
      maxRounds: 12,
    } as Awaited<ReturnType<typeof getClassById>>);
    mockedGetRoundByClassAndNumber.mockResolvedValue(null);
    mockedCreateAndActivateRound.mockResolvedValue({
      class: {
        id: "class-1",
        currentRound: 1,
        status: ClassStatus.IN_PROGRESS,
      },
      round: {
        id: "round-1",
        classId: "class-1",
        roundNumber: 1,
        deadline: null,
      },
    } as Awaited<ReturnType<typeof createAndActivateRound>>);

    const response = (await POST(
      new NextRequest("http://localhost/api/rounds", {
        method: "POST",
        body: JSON.stringify({
          classId: "class-1",
        }),
      })
    ))!;

    expect(response.status).toBe(201);
    expect(mockedCreateAndActivateRound).toHaveBeenCalledWith(
      expect.objectContaining({
        classId: "class-1",
        roundNumber: 1,
        nextClassStatus: ClassStatus.IN_PROGRESS,
      })
    );
    expect(mockedRecordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "round.create",
        entityType: "round",
        entityId: "round-1",
      })
    );
  });

  it("blocks creating the next round before the current one is completed", async () => {
    mockedGetAccessibleClassRecord.mockResolvedValue({
      id: "class-1",
      currentRound: 2,
    } as Awaited<ReturnType<typeof getAccessibleClassRecord>>);
    mockedGetClassById.mockResolvedValue({
      id: "class-1",
      status: ClassStatus.IN_PROGRESS,
      currentRound: 2,
      maxRounds: 12,
    } as Awaited<ReturnType<typeof getClassById>>);
    mockedGetRoundByClassAndNumber.mockResolvedValue({
      id: "round-2",
      status: RoundStatus.PENDING,
    } as Awaited<ReturnType<typeof getRoundByClassAndNumber>>);

    const response = (await POST(
      new NextRequest("http://localhost/api/rounds", {
        method: "POST",
        body: JSON.stringify({
          classId: "class-1",
        }),
      })
    ))!;

    expect(response.status).toBe(409);
    expect(mockedCreateAndActivateRound).not.toHaveBeenCalled();
  });

  it("updates environment parameters for a pending round", async () => {
    mockedGetRoundById.mockResolvedValue({
      id: "round-2",
      classId: "class-1",
      roundNumber: 2,
      status: RoundStatus.PENDING,
    } as Awaited<ReturnType<typeof getRoundById>>);
    mockedGetAccessibleClassRecord.mockResolvedValue({
      id: "class-1",
      currentRound: 2,
    } as Awaited<ReturnType<typeof getAccessibleClassRecord>>);
    mockedUpdateRoundEnvironment.mockResolvedValue({
      id: "round-2",
      classId: "class-1",
      roundNumber: 2,
      status: RoundStatus.PENDING,
      seasonFactor: 1.06,
      economyFactor: 1.04,
      eventFactor: 1.09,
      eventDescription: "环境摘要：春季会展期；天气：晴朗平稳；景气：温和增长；事件：大型会展；提示：会展和商务客流明显回升。",
      randomSeed: "env:class-1:2:demo",
    } as Awaited<ReturnType<typeof updateRoundEnvironment>>);

    const response = (await PATCH(
      new NextRequest("http://localhost/api/rounds", {
        method: "PATCH",
        body: JSON.stringify({
          roundId: "round-2",
          seasonFactor: 1.06,
          economyFactor: 1.04,
          eventFactor: 1.09,
          randomSeed: "env:class-1:2:demo",
        }),
      })
    ))!;

    expect(response.status).toBe(200);
    expect(mockedUpdateRoundEnvironment).toHaveBeenCalledWith(
      expect.objectContaining({
        roundId: "round-2",
        seasonFactor: 1.06,
        economyFactor: 1.04,
        eventFactor: 1.09,
        randomSeed: "env:class-1:2:demo",
      })
    );
    expect(mockedRecordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "round.environment.update",
        entityType: "round",
        entityId: "round-2",
      })
    );
  });

  it("keeps completed rounds read-only for environment updates", async () => {
    mockedGetRoundById.mockResolvedValue({
      id: "round-3",
      classId: "class-1",
      roundNumber: 3,
      status: RoundStatus.COMPLETED,
    } as Awaited<ReturnType<typeof getRoundById>>);
    mockedGetAccessibleClassRecord.mockResolvedValue({
      id: "class-1",
      currentRound: 3,
    } as Awaited<ReturnType<typeof getAccessibleClassRecord>>);

    const response = (await PATCH(
      new NextRequest("http://localhost/api/rounds", {
        method: "PATCH",
        body: JSON.stringify({
          roundId: "round-3",
          seasonFactor: 0.96,
        }),
      })
    ))!;

    expect(response.status).toBe(409);
    expect(mockedUpdateRoundEnvironment).not.toHaveBeenCalled();
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
      new NextRequest("http://localhost/api/rounds?classId=class-1")
    ))!;

    expect(response.status).toBe(401);
  });
});
