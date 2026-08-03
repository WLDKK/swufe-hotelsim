// @vitest-environment jsdom

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>(
    "@/lib/api/client"
  );

  return {
    ...actual,
    apiFetch: vi.fn(),
  };
});

import { TeacherGradingPanel } from "@/components/teacher/teacher-grading-panel";
import { apiFetch } from "@/lib/api/client";
import { renderWithQueryClient } from "@/test/test-utils";

const mockedApiFetch = vi.mocked(apiFetch);

const classesResponse = {
  classes: [
    {
      id: "class-1",
      name: "Hotel Simulation Class A",
      status: "IN_PROGRESS",
      currentRound: 2,
      maxRounds: 12,
      semester: {
        id: "semester-1",
        name: "2026 Spring Hotel Simulation",
        code: "HOTELSIM-2026-SPRING",
      },
    },
  ],
};

const resultsResponse = {
  roundNumber: 2,
  // Keep this UI test focused on grading write-back. Round switching has its
  // own coverage elsewhere, so we avoid the intermediate refetch here.
  availableRoundNumbers: [],
  leaderboard: [
    {
      teamId: "team-1",
      rankOverall: 1,
      rankRevenue: 1,
      rankProfit: 1,
      totalRevenue: 1_250_000,
      netProfit: 210_000,
      occupancyRate: 0.82,
      adr: 598,
      revpar: 490,
      overallMarketShare: 0.31,
      team: {
        id: "team-1",
        name: "Team Phoenix",
        hotelName: "Phoenix Grand Hotel",
        color: "#8B1A1A",
      },
    },
  ],
  results: [
    {
      id: "result-1",
      teamId: "team-1",
      roundNumber: 2,
      teacherScore: null,
      teacherComment: null,
      totalRevenue: 1_250_000,
      netProfit: 210_000,
      occupancyRate: 0.82,
      adr: 598,
      revpar: 490,
      guestSatisfactionEnd: 86,
      esgScoreEnd: 71,
      cashBalanceEnd: 52_000_000,
      team: {
        id: "team-1",
        name: "Team Phoenix",
        hotelName: "Phoenix Grand Hotel",
        color: "#8B1A1A",
      },
    },
  ],
};

describe("TeacherGradingPanel", () => {
  beforeEach(() => {
    mockedApiFetch.mockImplementation(async (input, init) => {
      const url = String(input);

      if (url === "/api/classes") {
        return classesResponse;
      }

      if (url.startsWith("/api/simulation/results?classId=class-1")) {
        return resultsResponse;
      }

      if (url === "/api/grading" && init?.method === "PATCH") {
        return {
          result: {
            id: "result-1",
            teacherScore: 87.5,
            teacherComment: "Strong recovery this round.",
          },
        };
      }

      throw new Error(`Unhandled apiFetch call: ${url}`);
    });
  });

  it("loads grading data and saves teacher feedback through the live API client", async () => {
    const user = userEvent.setup();

    renderWithQueryClient(<TeacherGradingPanel initialClassId="class-1" />);

    expect(
      await screen.findByText("Teacher grading and feedback workspace")
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.queryByText("Loading grading workspace...")
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /save grading/i })
      ).toBeInTheDocument();
    });

    const scoreInput = screen.getByLabelText("Teacher score");
    const commentInput = screen.getByLabelText("Teacher comment");

    await user.clear(scoreInput);
    await user.type(scoreInput, "87.5");
    await user.type(commentInput, "Strong recovery this round.");
    await user.click(screen.getByRole("button", { name: /save grading/i }));

    await waitFor(() => {
      expect(mockedApiFetch).toHaveBeenCalledWith(
        "/api/grading",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            resultId: "result-1",
            teacherScore: 87.5,
            teacherComment: "Strong recovery this round.",
          }),
        })
      );
    });

    expect(
      await screen.findByText(
        "Teacher grading has been saved to the live results record."
      )
    ).toBeInTheDocument();
  });
});
