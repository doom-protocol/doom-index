"use client";

/**
 * Legacy RealtimeDashboard component
 * @deprecated This component is part of the legacy 8-token system and should not be used.
 * It displays an empty dashboard for backward compatibility.
 */
interface RealtimeDashboardProps {
  isHelpOpen: boolean;
  onHelpToggle: (open: boolean) => void;
}

export const RealtimeDashboard: React.FC<RealtimeDashboardProps> = ({ isHelpOpen: _isHelpOpen, onHelpToggle: _onHelpToggle }) => {
  // Legacy dashboard - return empty component
  return null;
};
