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

import { StudentJoinClassPanel } from "@/components/student/student-join-class-panel";
import { ApiClientError, apiFetch } from "@/lib/api/client";
import { renderWithQueryClient } from "@/test/test-utils";

const mockedApiFetch = vi.mocked(apiFetch);

describe("StudentJoinClassPanel", () => {
  beforeEach(() => {
    mockedApiFetch.mockReset();
  });

  it("waits for an explicit submit, uppercases the join code, and renders the verified class result", async () => {
    const user = userEvent.setup();

    mockedApiFetch.mockResolvedValue({
      class: {
        id: "class-1",
        name: "Hotel Simulation Class A",
        joinCode: "HOTEL-26-A-305",
        maxTeams: 8,
        currentRound: 2,
        maxRounds: 12,
        status: "IN_PROGRESS",
        semester: {
          id: "semester-1",
          name: "2026 Spring Hotel Simulation",
          code: "HS-2026-SPRING",
          creator: {
            id: "teacher-1",
            name: "Prof. Liu",
            email: "teacher@hotelsim.example",
          },
        },
        _count: {
          teams: 4,
        },
      },
    });

    renderWithQueryClient(
      <StudentJoinClassPanel
        currentWorkspace={{
          team: {
            id: "team-1",
            name: "Team Phoenix",
            hotelName: "Phoenix Grand Hotel",
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
        }}
      />
    );

    expect(
      screen.getByText("Enter a join code to preview the matching class and semester.")
    ).toBeInTheDocument();
    expect(mockedApiFetch).not.toHaveBeenCalled();

    const verifyButton = screen.getByRole("button", { name: "Verify join code" });
    expect(verifyButton).toBeDisabled();

    await user.type(screen.getByLabelText("Join code"), " hotel-26-a-305 ");
    expect(verifyButton).toBeEnabled();
    await user.click(verifyButton);

    await waitFor(() => {
      expect(mockedApiFetch).toHaveBeenCalledWith(
        "/api/classes?joinCode=HOTEL-26-A-305"
      );
    });

    expect(await screen.findByText("Hotel Simulation Class A")).toBeInTheDocument();
    expect(screen.getByText("Prof. Liu")).toBeInTheDocument();
    expect(screen.getByText(/The invitation code is valid\./)).toBeInTheDocument();
  });

  it("shows the unassigned summary and the generic fallback when the lookup fails unexpectedly", async () => {
    const user = userEvent.setup();

    mockedApiFetch.mockRejectedValue(new Error("network down"));

    renderWithQueryClient(<StudentJoinClassPanel currentWorkspace={null} />);

    expect(screen.getByText("Unassigned")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Join code"), "bad-code");
    await user.click(screen.getByRole("button", { name: "Verify join code" }));

    expect(
      await screen.findByText("Failed to verify the join code.")
    ).toBeInTheDocument();
  });

  it("shows live API lookup failures for invalid or missing class codes", async () => {
    const user = userEvent.setup();

    mockedApiFetch.mockRejectedValue(new ApiClientError("Class not found.", 404));

    renderWithQueryClient(<StudentJoinClassPanel currentWorkspace={null} />);

    await user.type(screen.getByLabelText("Join code"), "BAD-CODE");
    await user.click(screen.getByRole("button", { name: "Verify join code" }));

    expect(await screen.findByText("Class not found.")).toBeInTheDocument();
  });
});
