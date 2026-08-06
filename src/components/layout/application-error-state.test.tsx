// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApplicationErrorState } from "@/components/layout/application-error-state";

describe("ApplicationErrorState", () => {
  it("offers a keyboard-accessible retry action", async () => {
    const reset = vi.fn();
    render(<ApplicationErrorState reset={reset} />);

    await userEvent.click(screen.getByRole("button", { name: "重新加载" }));
    expect(reset).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("link", { name: "返回首页" })).toHaveAttribute("href", "/");
  });
});
