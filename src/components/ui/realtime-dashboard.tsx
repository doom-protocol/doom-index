"use client";

import { Html } from "@react-three/drei";
import { useMc } from "@/hooks/use-mc";
import type { TokenTicker } from "@/types/domain";

const TOKEN_LABELS: Record<TokenTicker, string> = {
  CO2: "Carbon Dioxide",
  ICE: "Ice Coverage",
  FOREST: "Forest Area",
  NUKE: "Nuclear Activity",
  MACHINE: "Mechanization",
  PANDEMIC: "Disease Spread",
  FEAR: "Fear Index",
  HOPE: "Hope Index",
};

export const RealtimeDashboard: React.FC = () => {
  const { data, isLoading, isError } = useMc();

  return (
    <Html
      transform
      position={[2.5, 1.6, -4.5]}
      distanceFactor={1.5}
      style={{
        width: "400px",
        padding: "20px",
        background: "rgba(0, 0, 0, 0.8)",
        backdropFilter: "blur(10px)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        borderRadius: "8px",
        color: "white",
        fontFamily: "monospace",
      }}
    >
      <div>
        <h2 style={{ fontSize: "18px", marginBottom: "16px", fontWeight: "bold" }}>Market Indicators</h2>

        {isLoading && <p style={{ opacity: 0.6 }}>Loading...</p>}
        {isError && <p style={{ color: "#ff6b6b" }}>Error loading data</p>}

        {data && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {(Object.keys(data.tokens) as TokenTicker[]).map(ticker => (
              <div key={ticker} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "12px", opacity: 0.8 }}>{TOKEN_LABELS[ticker]}</span>
                <span style={{ fontSize: "14px", fontWeight: "bold" }}>${data.tokens[ticker].toFixed(4)}</span>
              </div>
            ))}
            <div
              style={{
                marginTop: "8px",
                paddingTop: "12px",
                borderTop: "1px solid rgba(255, 255, 255, 0.1)",
                fontSize: "10px",
                opacity: 0.5,
              }}
            >
              Last updated: {new Date(data.generatedAt).toLocaleTimeString()}
            </div>
          </div>
        )}
      </div>
    </Html>
  );
};
