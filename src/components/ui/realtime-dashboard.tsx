"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { Quaternion, Vector3, type Group } from "three";
import { useMc } from "@/hooks/use-mc";
import { TOKEN_CONFIG_MAP, TOKEN_TICKERS, TOKEN_DESCRIPTIONS } from "@/constants/token";
import type { TokenTicker } from "@/types/domain";
import { getPumpFunUrl } from "@/utils/url";

type McResponse = {
  tokens: Record<TokenTicker, number>;
  generatedAt: string;
};

const HELP_OVERLAY_DISTANCE = 0.75;
const HELP_OVERLAY_LERP_FACTOR = 0.2;
const HELP_OVERLAY_Y_OFFSET = -0.01;

const createInitialHighlightState = () =>
  TOKEN_TICKERS.reduce(
    (acc, ticker) => {
      acc[ticker] = false;
      return acc;
    },
    {} as Record<TokenTicker, boolean>,
  );

interface RealtimeDashboardProps {
  isHelpOpen: boolean;
  onHelpToggle: (open: boolean) => void;
}

export const RealtimeDashboard: React.FC<RealtimeDashboardProps> = ({ isHelpOpen, onHelpToggle }) => {
  const { camera, size } = useThree();
  const isMobile = size.width <= 480;
  const { data, isLoading, isError } = useMc();
  const [highlightState, setHighlightState] = useState<Record<TokenTicker, boolean>>(createInitialHighlightState);
  const previousDataRef = useRef<McResponse | null>(null);
  const timeoutsRef = useRef<number[]>([]);
  const helpAnchorRef = useRef<Group>(null);
  const helpCardRef = useRef<HTMLDivElement | null>(null);
  const forwardDirectionRef = useRef(new Vector3());
  const targetPositionRef = useRef(new Vector3());
  const tempQuaternionRef = useRef(new Quaternion());
  const getFontSize = useCallback(
    (desktopSize: number, mobileSize?: number) =>
      `${isMobile ? (mobileSize ?? Math.max(desktopSize - 2, 10)) : desktopSize}px`,
    [isMobile],
  );
  const helpCloseButtonSize = isMobile ? 20 : 24;

  const helpDistanceFactor = useMemo(() => {
    const { width } = size;

    if (width <= 480) {
      return 0.34;
    }

    if (width <= 768) {
      return 0.35;
    }

    if (width <= 1440) {
      return 0.36;
    }

    const scale = 1440 / width;
    return 0.36 * Math.max(scale, 0.26);
  }, [size]);

  const updateHelpAnchor = useCallback(
    (lerpFactor: number) => {
      const anchor = helpAnchorRef.current;
      if (!anchor) {
        return;
      }

      const forwardDirection = forwardDirectionRef.current;
      const targetPosition = targetPositionRef.current;
      const tempQuaternion = tempQuaternionRef.current;

      forwardDirection.set(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
      targetPosition.copy(camera.position).addScaledVector(forwardDirection, HELP_OVERLAY_DISTANCE);
      tempQuaternion.copy(camera.quaternion);
      targetPosition.y += HELP_OVERLAY_Y_OFFSET;

      if (lerpFactor >= 1) {
        anchor.position.copy(targetPosition);
        anchor.quaternion.copy(tempQuaternion);
        return;
      }

      anchor.position.lerp(targetPosition, lerpFactor);
      anchor.quaternion.slerp(tempQuaternion, lerpFactor);
    },
    [camera],
  );

  useFrame(() => {
    if (!isHelpOpen) {
      return;
    }
    updateHelpAnchor(HELP_OVERLAY_LERP_FACTOR);
  });

  useEffect(() => {
    if (!isHelpOpen) {
      return;
    }
    updateHelpAnchor(1);
  }, [isHelpOpen, updateHelpAnchor]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") {
      return;
    }

    const logCameraPosition = () => {
      const { x, y, z } = camera.position;
      console.debug("[RealtimeDashboard] camera position", {
        x: Number(x.toFixed(2)),
        y: Number(y.toFixed(2)),
        z: Number(z.toFixed(2)),
      });
    };

    logCameraPosition();
    const intervalId = window.setInterval(logCameraPosition, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [camera]);

  useEffect(() => {
    if (!isHelpOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!helpCardRef.current) {
        return;
      }

      const path = event.composedPath();
      if (path.includes(helpCardRef.current)) {
        return;
      }

      onHelpToggle(false);
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isHelpOpen, onHelpToggle]);

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(timeoutId => window.clearTimeout(timeoutId));
      timeoutsRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!data) return;

    const prev = previousDataRef.current;

    if (!prev) {
      previousDataRef.current = data;
      return;
    }

    if (prev.generatedAt === data.generatedAt) {
      return;
    }

    const updatedTickers = TOKEN_TICKERS.filter(ticker => {
      const prevValue = prev.tokens[ticker];
      const nextValue = data.tokens[ticker];
      return typeof prevValue === "number" && typeof nextValue === "number" && nextValue !== prevValue;
    });

    if (updatedTickers.length > 0) {
      setHighlightState(prevState => {
        const nextState = { ...prevState };
        updatedTickers.forEach(ticker => {
          nextState[ticker] = true;
        });
        return nextState;
      });

      updatedTickers.forEach(ticker => {
        const timeoutId = window.setTimeout(() => {
          setHighlightState(prevState => ({ ...prevState, [ticker]: false }));
          timeoutsRef.current = timeoutsRef.current.filter(id => id !== timeoutId);
        }, 700);
        timeoutsRef.current.push(timeoutId);
      });
    }

    previousDataRef.current = data;
  }, [data]);
  const numberFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        maximumFractionDigits: 2,
        minimumFractionDigits: 0,
      }),
    [],
  );

  const totalMarketCap =
    data?.tokens != null ? TOKEN_TICKERS.reduce((acc, ticker) => acc + (data.tokens[ticker] ?? 0), 0) : 0;

  const tokenEntries = TOKEN_TICKERS.map(ticker => {
    const value = data?.tokens?.[ticker] ?? 0;
    const ratio = totalMarketCap > 0 ? value / totalMarketCap : 0;
    return { ticker, value, ratio };
  });

  const dominantEntry = tokenEntries.reduce<{
    ticker: TokenTicker;
    value: number;
    ratio: number;
  } | null>((prev, current) => {
    if (current.value <= 0) return prev;
    if (!prev || current.value > prev.value) {
      return current;
    }
    return prev;
  }, null);

  const dominantDescription = dominantEntry ? TOKEN_DESCRIPTIONS[dominantEntry.ticker] : null;
  const dominantShareLabel =
    dominantEntry && dominantEntry.ratio > 0 ? `${(dominantEntry.ratio * 100).toFixed(1)}%` : "—";

  return (
    <>
      <Html
        transform
        position={[1.8, 0.5, 2.2]}
        rotation={[0, -Math.PI / 4 + Math.PI, 0]}
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
          position: "relative",
        }}
      >
        <button
          type="button"
          onClick={() => onHelpToggle(!isHelpOpen)}
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            width: "28px",
            height: "28px",
            borderRadius: "9999px",
            border: "1px solid rgba(255, 255, 255, 0.25)",
            background: "rgba(255, 255, 255, 0.08)",
            color: "#ffffff",
            fontSize: "16px",
            fontWeight: 700,
            cursor: "pointer",
            transition: "transform 0.2s ease, background 0.2s ease",
            touchAction: "manipulation",
          }}
          onPointerEnter={e => {
            e.currentTarget.style.transform = "scale(1.08)";
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
          }}
          onPointerLeave={e => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
          }}
          onPointerDown={e => {
            e.currentTarget.style.transform = "scale(0.95)";
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)";
          }}
          onPointerUp={e => {
            e.currentTarget.style.transform = "scale(1.08)";
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
          }}
        >
          ?
        </button>
        <div>
          <h2 style={{ fontSize: "16px", marginBottom: "14px", fontWeight: "bold" }}>Elements of the World</h2>

          {isLoading && <p style={{ fontSize: "11px", opacity: 0.6 }}>Loading...</p>}
          {isError && <p style={{ fontSize: "11px", color: "#ff6b6b" }}>Error loading data</p>}

          {data && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  padding: "14px",
                  background: "rgba(255, 255, 255, 0.045)",
                  borderRadius: "10px",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  boxShadow: "inset 0 0 18px rgba(0, 0, 0, 0.65)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span
                    style={{
                      fontSize: "11px",
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                      opacity: 0.6,
                    }}
                  >
                    Global Resonance
                  </span>
                  <span style={{ fontSize: "18px", fontWeight: "bold" }}>
                    ${numberFormatter.format(totalMarketCap)}
                  </span>
                </div>
                {dominantDescription && dominantEntry && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                      padding: "12px",
                      borderRadius: "10px",
                      background: "rgba(16, 20, 32, 0.65)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <span
                          style={{
                            fontSize: "11px",
                            letterSpacing: "0.16em",
                            textTransform: "uppercase",
                            opacity: 0.58,
                          }}
                        >
                          Dominant Motif
                        </span>
                        <span style={{ fontSize: "14px", fontWeight: 700 }}>{dominantDescription.title}</span>
                      </div>
                      <span style={{ fontSize: "12px", opacity: 0.7 }}>{dominantShareLabel}</span>
                    </div>
                    <p style={{ fontSize: "11px", lineHeight: 1.6, opacity: 0.7 }}>{dominantDescription.motif}</p>
                    <div
                      style={{
                        width: "100%",
                        height: "6px",
                        borderRadius: "9999px",
                        background: "rgba(255, 255, 255, 0.12)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(Math.max(dominantEntry.ratio, 0), 1) * 100}%`,
                          height: "100%",
                          background:
                            dominantEntry.ticker === "HOPE"
                              ? "linear-gradient(90deg, #60a5fa, #facc15)"
                              : "linear-gradient(90deg, #f97316, #ef4444)",
                          transition: "width 0.6s ease",
                        }}
                      />
                    </div>
                  </div>
                )}
                <span style={{ fontSize: "10px", opacity: 0.55, letterSpacing: "0.08em" }} />
              </div>

              {(Object.keys(data.tokens) as TokenTicker[]).map(ticker => {
                const tokenConfig = TOKEN_CONFIG_MAP[ticker];
                const pumpFunUrl = getPumpFunUrl(tokenConfig.address);
                const isHighlighted = highlightState[ticker];
                const currentValue = data.tokens[ticker];
                const share = totalMarketCap > 0 ? currentValue / totalMarketCap : 0;
                const shareLabel = share > 0 ? `${(share * 100).toFixed(1)}%` : "—";
                return (
                  <div
                    key={ticker}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "16px",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      background: isHighlighted ? "rgba(74, 222, 128, 0.22)" : "rgba(255, 255, 255, 0.04)",
                      boxShadow: isHighlighted ? "0 0 18px rgba(74, 222, 128, 0.35)" : "none",
                      transform: isHighlighted ? "scale(1.025)" : "scale(1)",
                      transition: "background 0.6s ease, transform 0.6s ease, box-shadow 0.6s ease",
                    }}
                  >
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
                        touchAction: "manipulation",
                      }}
                      onPointerEnter={e => (e.currentTarget.style.color = "#22c55e")}
                      onPointerLeave={e => (e.currentTarget.style.color = "#4ade80")}
                      onPointerDown={e => (e.currentTarget.style.color = "#16a34a")}
                      onPointerUp={e => (e.currentTarget.style.color = "#22c55e")}
                    >
                      ${ticker}
                    </a>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                      <span
                        style={{
                          fontSize: "14px",
                          fontWeight: "bold",
                          transform: isHighlighted ? "translateY(-2px)" : "translateY(0)",
                          transition: "transform 0.6s ease",
                        }}
                      >
                        ${numberFormatter.format(currentValue)}
                      </span>
                      <span style={{ fontSize: "10px", opacity: 0.65, letterSpacing: "0.05em" }}>{shareLabel}</span>
                    </div>
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
      {isHelpOpen ? (
        <group ref={helpAnchorRef}>
          <Html
            transform
            distanceFactor={helpDistanceFactor}
            style={{
              pointerEvents: "auto",
              width: "min(440px, 75vw)",
              maxHeight: "65vh",
              padding: isMobile ? "14px 16px" : "18px 20px",
              background: "rgba(12, 12, 18, 0.97)",
              border: "1px solid rgba(255, 255, 255, 0.16)",
              borderRadius: "12px",
              boxShadow: "0 22px 56px rgba(4, 8, 24, 0.65)",
              color: "white",
              fontFamily: "monospace",
              overflowY: "auto",
              position: "relative",
            }}
          >
            <button
              type="button"
              onClick={() => onHelpToggle(false)}
              style={{
                position: "absolute",
                top: isMobile ? "10px" : "12px",
                right: isMobile ? "10px" : "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: `${helpCloseButtonSize}px`,
                minWidth: `${helpCloseButtonSize}px`,
                height: `${helpCloseButtonSize}px`,
                borderRadius: "9999px",
                border: "1px solid rgba(255, 255, 255, 0.25)",
                background: "rgba(255, 255, 255, 0.14)",
                color: "#ffffff",
                fontSize: getFontSize(12, 10),
                fontWeight: 700,
                lineHeight: 1,
                flexShrink: 0,
                cursor: "pointer",
                transition: "transform 0.2s ease, background 0.2s ease",
                touchAction: "manipulation",
                zIndex: 10,
              }}
              onPointerEnter={e => {
                e.currentTarget.style.transform = "scale(1.1)";
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)";
              }}
              onPointerLeave={e => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.14)";
              }}
              onPointerDown={e => {
                e.currentTarget.style.transform = "scale(0.95)";
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.25)";
              }}
              onPointerUp={e => {
                e.currentTarget.style.transform = "scale(1.1)";
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)";
              }}
            >
              ×
            </button>
            <div
              ref={helpCardRef}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "5px",
                marginBottom: isMobile ? "14px" : "18px",
              }}
            >
              <h3 style={{ fontSize: getFontSize(16, 14), fontWeight: 700, letterSpacing: "0.1em" }}>
                DOOM INDEX SIGNAL GUIDE
              </h3>
              <p style={{ fontSize: getFontSize(11, 10), opacity: 0.72, maxWidth: "420px", lineHeight: 1.5 }}>
                DOOM INDEX listens to live market caps on Solana. Every minute the gallery rebuilds a single painting—if
                the numbers shift, the world on the canvas mutates. Each token below bends the prompt in a specific
                direction.
              </p>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                marginBottom: isMobile ? "14px" : "18px",
              }}
            >
              <div style={{ display: "flex", gap: "14px", alignItems: "baseline" }}>
                <span
                  style={{
                    fontSize: getFontSize(10, 9),
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    opacity: 0.6,
                  }}
                >
                  Mechanics
                </span>
                <p style={{ fontSize: getFontSize(11, 10), opacity: 0.72, lineHeight: 1.5 }}>
                  1. Fetch current market caps → 2. Compare against the previous minute → 3. If anything moved, rebuild
                  the prompt and generate a new frame → 4. Store the image and state for the next cycle.
                </p>
              </div>
            </div>
            <div style={{ display: "grid", gap: "14px" }}>
              {TOKEN_TICKERS.map(ticker => {
                const description = TOKEN_DESCRIPTIONS[ticker];
                return (
                  <div
                    key={ticker}
                    style={{
                      padding: "12px 16px",
                      borderRadius: "12px",
                      background: "rgba(255, 255, 255, 0.06)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "5px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                      }}
                    >
                      <span style={{ fontSize: getFontSize(11, 10), letterSpacing: "0.18em", opacity: 0.58 }}>
                        ${ticker}
                      </span>
                      <span style={{ fontSize: getFontSize(10, 9), opacity: 0.52, letterSpacing: "0.08em" }}>
                        Threshold · 1M MC
                      </span>
                    </div>
                    <h4 style={{ fontSize: getFontSize(13, 11), fontWeight: 700 }}>{description.title}</h4>
                    <p style={{ fontSize: getFontSize(11, 10), opacity: 0.78, lineHeight: 1.5 }}>
                      {description.description}
                    </p>
                    <p
                      style={{
                        fontSize: getFontSize(10, 9),
                        opacity: 0.62,
                        lineHeight: 1.5,
                        fontStyle: "italic",
                      }}
                    >
                      {description.motif}
                    </p>
                  </div>
                );
              })}
            </div>
          </Html>
        </group>
      ) : null}
    </>
  );
};
