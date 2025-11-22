import { describe, expect, it, mock } from "bun:test";
import { render, fireEvent } from "@testing-library/react";
import { MintButton } from "@/components/ui/mint-button";

// Mock analytics
mock.module("@/lib/analytics", () => ({
  GA_EVENTS: { MINT_BUTTON_CLICK: "mint_button_click" },
  sendGAEvent: mock(() => {}),
}));

// Mock use-haptic
mock.module("use-haptic", () => ({
  useHaptic: () => ({
    triggerHaptic: mock(() => {}),
  }),
}));

describe("MintButton", () => {
  it("renders correctly", () => {
    const { getByRole } = render(<MintButton />);
    const button = getByRole("button");
    expect(button).toBeInTheDocument();
    expect(button.textContent).toMatch(/Export GLB/i);
  });

  it("handles click events", () => {
    const handleClick = mock(() => {});
    const { getByRole } = render(<MintButton onClick={handleClick} />);

    const button = getByRole("button");
    fireEvent.click(button);

    expect(handleClick).toHaveBeenCalled();
  });

  it("shows loading state", () => {
    const { getByRole, getByText } = render(<MintButton isLoading={true} />);
    const button = getByRole("button");
    expect(button).toBeDisabled();
    expect(getByText(/Exporting/i)).toBeInTheDocument();
  });

  it("shows error state", () => {
    const { getByRole, getByText } = render(<MintButton isError={true} />);
    const button = getByRole("button");
    expect(button).toBeDisabled();
    expect(getByText(/Failed/i)).toBeInTheDocument();
  });

  it("is disabled when disabled prop is true", () => {
    const { getByRole } = render(<MintButton disabled={true} />);
    const button = getByRole("button");
    expect(button).toBeDisabled();
  });
});
