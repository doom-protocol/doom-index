"use client";

import { Html } from "@react-three/drei";
import { useMc } from "@/hooks/use-mc";
import { TOKEN_CONFIG_MAP } from "@/constants/token";
import type { TokenTicker } from "@/types/domain";

const getPumpFunUrl = (address: string) => `https://pump.fun/${address}`;

export const RealtimeDashboard: React.FC = () => {
  const { data, isLoading, isError } = useMc();

  return (
    <Html
      transform
      position={[1.8, 0.5, 2.2]}
      rotation={[0, -Math.PI / 4, 0]}
      distanceFactor={0.6}
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
        <h2 style={{ fontSize: "18px", marginBottom: "16px", fontWeight: "bold" }}>Elements of the World</h2>

        {isLoading && <p style={{ opacity: 0.6 }}>Loading...</p>}
        {isError && <p style={{ color: "#ff6b6b" }}>Error loading data</p>}

        {data && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {(Object.keys(data.tokens) as TokenTicker[]).map(ticker => {
              const tokenConfig = TOKEN_CONFIG_MAP[ticker];
              const pumpFunUrl = getPumpFunUrl(tokenConfig.address);

              return (
                <div key={ticker} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <a
                    href={pumpFunUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: "14px",
                      fontWeight: "bold",
                      color: "#4ade80",
                      textDecoration: "none",
                      cursor: "pointer",
                      transition: "color 0.2s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#22c55e")}
                    onMouseLeave={e => (e.currentTarget.style.color = "#4ade80")}
                  >
                    ${ticker}
                  </a>
                  <span style={{ fontSize: "14px", fontWeight: "bold" }}>${data.tokens[ticker].toFixed(4)}</span>
                </div>
              );
            })}
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
