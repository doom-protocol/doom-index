import { describe, expect, it, mock } from "bun:test";
import { render, fireEvent } from "@testing-library/react";
import { MintButton } from "@/components/ui/mint-button";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// Mock analytics
mock.module("@/lib/analytics", () => ({
  GA_EVENTS: {
    MINT_BUTTON_CLICK: "mint_button_click",
    MINT_UPLOAD_START: "mint_upload_start",
    MINT_WALLET_CONNECT: "mint_wallet_connect",
    MINT_TRANSACTION_START: "mint_transaction_start",
    MINT_SUCCESS: "mint_success",
  },
  sendGAEvent: mock(() => {}),
}));

// Mock use-haptic
mock.module("use-haptic", () => ({
  useHaptic: () => ({
    triggerHaptic: mock(() => {}),
  }),
}));

// Mock MintModal
const MockMintModal: React.FC<{ isOpen: boolean }> = ({ isOpen }) =>
  isOpen ? <div data-testid="mint-modal">Modal</div> : null;
MockMintModal.displayName = "MockMintModal";

mock.module("@/components/ui/mint-modal", () => ({
  MintModal: MockMintModal,
}));

// Create wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const Wrapper: React.FC<{ children: ReactNode }> = ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = "QueryClientWrapper";

  return Wrapper;
};

describe("MintButton", () => {
  it("renders correctly", () => {
    const { getByRole } = render(<MintButton />, { wrapper: createWrapper() });
    const button = getByRole("button");
    expect(button).toBeInTheDocument();
    expect(button.textContent).toMatch(/Export GLB/i);
  });

  it("handles click events", () => {
    const handleClick = mock(() => {});
    const { getByRole } = render(<MintButton onClick={handleClick} />, { wrapper: createWrapper() });

    const button = getByRole("button");
    fireEvent.click(button);

    expect(handleClick).toHaveBeenCalled();
  });

  it("shows loading state", () => {
    const { getByRole, getByText } = render(<MintButton isLoading={true} />, { wrapper: createWrapper() });
    const button = getByRole("button");
    expect(button).toBeDisabled();
    expect(getByText(/Exporting/i)).toBeInTheDocument();
  });

  it("shows error state", () => {
    const { getByRole, getByText } = render(<MintButton isError={true} />, { wrapper: createWrapper() });
    const button = getByRole("button");
    expect(button).toBeDisabled();
    expect(getByText(/Failed/i)).toBeInTheDocument();
  });

  it("is disabled when disabled prop is true", () => {
    const { getByRole } = render(<MintButton disabled={true} />, { wrapper: createWrapper() });
    const button = getByRole("button");
    expect(button).toBeDisabled();
  });
});
