import { beforeEach, describe, expect, it, vi } from "vitest";

const { updateMany } = vi.hoisted(() => ({ updateMany: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  default: { round: { updateMany } },
}));

import { claimPendingRound } from "@/lib/dal/rounds";

describe("claimPendingRound", () => {
  beforeEach(() => updateMany.mockReset());

  it("claims only a round that is still pending", async () => {
    updateMany.mockResolvedValue({ count: 1 });

    await expect(claimPendingRound("round-1", { randomSeed: "seed-1" })).resolves.toBe(true);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "round-1", status: "PENDING" },
      data: { randomSeed: "seed-1", status: "PROCESSING" },
    });
  });

  it("rejects a competing processor after the round was claimed", async () => {
    updateMany.mockResolvedValue({ count: 0 });
    await expect(claimPendingRound("round-1", {})).resolves.toBe(false);
  });
});
