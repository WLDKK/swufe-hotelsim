import { beforeEach, describe, expect, it, vi } from "vitest";

const { classFindFirst, classFindUnique } = vi.hoisted(() => ({
  classFindFirst: vi.fn(),
  classFindUnique: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    class: { findFirst: classFindFirst, findUnique: classFindUnique },
  },
}));

import { getAccessibleClassRecord } from "@/lib/api/access";

describe("judge competition access", () => {
  beforeEach(() => {
    classFindFirst.mockReset();
    classFindUnique.mockReset();
  });

  it("scopes judge class access to an explicit competition assignment", async () => {
    classFindFirst.mockResolvedValue(null);
    await getAccessibleClassRecord(
      {
        id: "judge-1",
        role: "JUDGE",
        email: "judge@example.com",
        name: "Judge One",
        image: null,
        studentId: null,
        locale: "ZH_CN",
      },
      "class-1"
    );

    expect(classFindUnique).not.toHaveBeenCalled();
    expect(classFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "class-1",
          rounds: {
            some: {
              competitionStage: {
                competition: {
                  judgeAssignments: { some: { judgeId: "judge-1" } },
                },
              },
            },
          },
        }),
      })
    );
  });
});
