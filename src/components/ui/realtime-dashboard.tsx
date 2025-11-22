"use client";

import { useEffect } from "react";

/**
 * Legacy RealtimeDashboard component
 * @deprecated This component is part of the legacy 8-token system and should not be used.
 * It displays an empty dashboard for backward compatibility.
 */
interface RealtimeDashboardProps {
  isHelpOpen: boolean;
  onHelpToggle: (open: boolean) => void;
}

export const RealtimeDashboard: React.FC<RealtimeDashboardProps> = ({
  isHelpOpen: _isHelpOpen,
  onHelpToggle: _onHelpToggle,
}) => {
  // Add development warning when component is rendered
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.warn("RealtimeDashboard is deprecated — set showDashboard to false or restore implementation");
    }
  }, []);

  // Legacy dashboard - return empty component
  return null;
};
