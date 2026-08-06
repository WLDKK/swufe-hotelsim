import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMany, cacheQuery } = vi.hoisted(() => ({
  findMany: vi.fn(),
  cacheQuery: vi.fn((_key: unknown, query: () => Promise<unknown>) => query()),
}));

vi.mock("@/lib/prisma", () => ({
  default: { roundResult: { findMany } },
}));

vi.mock("@/lib/cache", () => ({
  cacheQuery,
  cacheTags: {
    classResults: (id: string) => `class-results:${id}`,
    classRounds: (id: string) => `class-rounds:${id}`,
  },
}));

import { getResultsForClassRound } from "@/lib/dal/results";

describe("judge result filtering", () => {
  beforeEach(() => {
    findMany.mockReset();
    cacheQuery.mockClear();
    findMany.mockResolvedValue([]);
  });

  it("filters results and cache keys by the assigned judge", async () => {
    await getResultsForClassRound("class-1", 3, "judge-1");

    expect(cacheQuery.mock.calls[0]?.[0]).toContain("judge-1");
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          round: {
            competitionStage: {
              competition: {
                judgeAssignments: { some: { judgeId: "judge-1" } },
              },
            },
          },
          roundNumber: 3,
          team: { classId: "class-1" },
        }),
      })
    );
  });
});
