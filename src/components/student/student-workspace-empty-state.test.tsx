// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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

import { StudentWorkspaceEmptyState } from "@/components/student/student-workspace-empty-state";
import { renderWithQueryClient } from "@/test/test-utils";

describe("StudentWorkspaceEmptyState", () => {
  it("renders the localized team empty-state copy and recovery actions", () => {
    renderWithQueryClient(<StudentWorkspaceEmptyState section="team" />);

    expect(
      screen.getByText("No team workspace is assigned yet")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "This account is authenticated correctly, but it is not yet attached to a simulation team, so no live roster or hotel profile can be resolved."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Verify join code" })
    ).toHaveAttribute("href", "/student/join");
  });
});
