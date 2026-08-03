// @vitest-environment jsdom

import { screen, waitFor } from "@testing-library/react";
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

vi.mock("@/i18n/use-locale", async () => {
  const messagesModule = await vi.importActual<typeof import("@/i18n/messages")>(
    "@/i18n/messages"
  );

  return {
    useLocale: () => ({
      locale: "en-US" as const,
      messages: messagesModule.localeMessages["en-US"],
      setLocale: vi.fn(),
    }),
  };
});

import { StudentTeamPanel } from "@/components/student/student-team-panel";
import { ApiClientError, apiFetch } from "@/lib/api/client";
import { renderWithQueryClient } from "@/test/test-utils";

const mockedApiFetch = vi.mocked(apiFetch);

const workspace = {
  team: {
    id: "team-1",
    name: "Team Phoenix",
    hotelName: "Phoenix Grand Hotel",
    color: "#8B1A1A",
    hotelState: {
      cashBalance: 52_000_000,
      totalDebt: 198_000_000,
      brandReputation: 68,
      guestSatisfaction: 84,
      esgScore: 73,
    },
  },
  courseClass: {
    id: "class-1",
    name: "Hotel Simulation Class A",
    status: "IN_PROGRESS",
    currentRound: 2,
    maxRounds: 12,
    semester: {
      id: "semester-1",
      name: "2026 Spring Hotel Simulation",
      code: "HS-2026-SPRING",
    },
  },
};

describe("StudentTeamPanel", () => {
  beforeEach(() => {
    mockedApiFetch.mockReset();
  });

  it("loads the live student team roster and hotel summary from the existing teams API", async () => {
    mockedApiFetch.mockResolvedValue({
      teams: [
        {
          id: "team-1",
          name: "Team Phoenix",
          hotelName: "Phoenix Grand Hotel",
          color: "#8B1A1A",
          class: {
            id: "class-1",
            name: "Hotel Simulation Class A",
            joinCode: "HOTEL-26-A-305",
            status: "IN_PROGRESS",
            currentRound: 2,
            maxRounds: 12,
          },
          hotelState: workspace.team.hotelState,
          members: [
            {
              id: "member-2",
              role: "MARKETING_MANAGER",
              user: {
                id: "user-2",
                name: "Alex Marketing",
                email: "alex.marketing@hotelsim.example",
                studentId: "2026HS02",
              },
            },
            {
              id: "member-1",
              role: "LEADER",
              user: {
                id: "user-1",
                name: "Phoenix Lead",
                email: "phoenix.lead@hotelsim.example",
                studentId: "2026HS01",
              },
            },
          ],
        },
      ],
    });

    renderWithQueryClient(<StudentTeamPanel workspace={workspace} />);

    expect(
      await screen.findByText("Team roster and hotel profile for Team Phoenix")
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(mockedApiFetch).toHaveBeenCalledWith("/api/teams?classId=class-1");
    });

    expect(screen.getAllByText("HOTEL-26-A-305").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Phoenix Lead").length).toBeGreaterThan(0);
    expect(screen.getByText(/phoenix\.lead@hotelsim\.example/i)).toBeInTheDocument();
    expect(screen.getAllByText("Leader").length).toBeGreaterThan(0);
    expect(screen.getByText("Marketing")).toBeInTheDocument();
    expect(screen.getByText(/52/i)).toBeInTheDocument();
  });

  it("falls back to the workspace shell message when the team API returns no matching team", async () => {
    mockedApiFetch.mockResolvedValue({
      teams: [],
    });

    renderWithQueryClient(<StudentTeamPanel workspace={workspace} />);

    expect(
      await screen.findByText(
        "The student workspace resolved a team shell, but the live team record could not be loaded. Refresh the page or verify that membership still exists."
      )
    ).toBeInTheDocument();
  });

  it("surfaces API errors instead of silently hiding team-loading failures", async () => {
    mockedApiFetch.mockRejectedValue(
      new ApiClientError("Team workspace failed to load.", 500)
    );

    renderWithQueryClient(<StudentTeamPanel workspace={workspace} />);

    expect(
      await screen.findByText("Team workspace failed to load.")
    ).toBeInTheDocument();
  });
});
