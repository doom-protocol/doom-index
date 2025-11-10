"use client";

import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { ACESFilmicToneMapping, DoubleSide, PCFSoftShadowMap } from "three";
import { OrbitControls, Grid, Stats } from "@react-three/drei";
import { Lights } from "./lights";
import { FramedPainting } from "./framed-painting";
import { CameraRig } from "./camera-rig";
import { RealtimeDashboard } from "../ui/realtime-dashboard";

interface GallerySceneProps {
  thumbnailUrl?: string;
  cameraPreset?: "dashboard" | "painting";
  showDashboard?: boolean;
}

const isDevelopment = process.env.NODE_ENV === "development";

const triggerHaptic = (event?: React.PointerEvent) => {
  // タッチイベントのコンテキスト内でhaptic feedbackをトリガー
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      // より長い振動時間で確実に動作させる
      navigator.vibrate(50); // 50msの振動
    } catch (error) {
      // エラーを無視（サポートされていない場合）
    }
  }

  // iOS Safari用のフォールバック（Taptic Engine）
  // 注意: これはWeb APIではないが、一部のブラウザで動作する可能性がある
  if (event?.nativeEvent && "vibrate" in event.nativeEvent) {
    try {
      (event.nativeEvent as any).vibrate?.(50);
    } catch (error) {
      // エラーを無視
    }
  }
};

export const GalleryScene: React.FC<GallerySceneProps> = ({
  thumbnailUrl,
  cameraPreset: initialCameraPreset = "painting",
  showDashboard = true,
}) => {
  const [isDashboardHelpOpen, setIsDashboardHelpOpen] = useState(false);
  const [currentCameraPreset, setCurrentCameraPreset] = useState<"dashboard" | "painting">(initialCameraPreset);

  return (
    <>
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{
          fov: 50,
          position: [0, 0.8, 0.8],
          near: 0.1,
          far: 100,
        }}
        gl={{ antialias: true }}
        onCreated={({ gl }) => {
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = PCFSoftShadowMap;
          gl.toneMapping = ACESFilmicToneMapping;
          gl.setClearColor("#050505");
        }}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          margin: 0,
          padding: 0,
          display: "block",
          background: "#000000",
        }}
      >
        <CameraRig preset={currentCameraPreset} />
        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          touches={{
            ONE: 0, // TOUCH_ROTATE (one finger rotation) - 0 = ROTATE
            TWO: 2, // TOUCH_DOLLY_PAN (two finger zoom/pan) - 2 = DOLLY_PAN
          }}
          enableZoom={true}
          enablePan={true}
          minDistance={0.5}
          maxDistance={5}
          target={[0, 0.8, 4.0]}
          rotateSpeed={1.0}
          zoomSpeed={1.0}
          panSpeed={0.5}
          enabled={!isDashboardHelpOpen}
          enableRotate={true}
          mouseButtons={{
            LEFT: 0, // ROTATE
            MIDDLE: 1, // DOLLY
            RIGHT: 2, // PAN
          }}
        />
        <Lights />

        {/* Debug helpers - Development only */}
        {isDevelopment && (
          <>
            <axesHelper args={[5]} />
            <Grid
              args={[10, 10]}
              cellSize={0.5}
              cellThickness={0.5}
              cellColor="#6f6f6f"
              sectionSize={1}
              sectionThickness={1}
              sectionColor="#9d4b4b"
              fadeDistance={25}
              fadeStrength={1}
              followCamera={false}
              infiniteGrid={false}
              position={[0, -0.5, 0]}
            />
          </>
        )}

        {/* Gallery architecture */}
        <group>
          {/* Floor */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
            <planeGeometry args={[10, 10]} />
            <meshStandardMaterial color="#4b4d68" roughness={0.48} metalness={0.26} side={DoubleSide} />
          </mesh>

          {/* Back wall */}
          <mesh position={[0, 1.65, 5]} rotation={[0, Math.PI, 0]} receiveShadow>
            <planeGeometry args={[10, 4.5]} />
            <meshStandardMaterial color="#6c6d89" roughness={0.84} metalness={0.11} side={DoubleSide} />
          </mesh>

          {/* Side walls */}
          <mesh rotation={[0, -Math.PI / 2, 0]} position={[5, 1.65, 0]} receiveShadow>
            <planeGeometry args={[10, 4.5]} />
            <meshStandardMaterial color="#686a86" roughness={0.84} metalness={0.11} side={DoubleSide} />
          </mesh>
          <mesh rotation={[0, Math.PI / 2, 0]} position={[-5, 1.65, 0]} receiveShadow>
            <planeGeometry args={[10, 4.5]} />
            <meshStandardMaterial color="#686a86" roughness={0.84} metalness={0.11} side={DoubleSide} />
          </mesh>

          {/* Front wall */}
          <mesh position={[0, 1.65, -5]} receiveShadow>
            <planeGeometry args={[10, 4.5]} />
            <meshStandardMaterial color="#686a86" roughness={0.84} metalness={0.11} side={DoubleSide} />
          </mesh>

          {/* Ceiling */}
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 3.3, 0]} receiveShadow>
            <planeGeometry args={[7, 7]} />
            <meshStandardMaterial color="#2d2d40" roughness={0.72} metalness={0.14} side={DoubleSide} />
          </mesh>
        </group>

        {/* Central framed painting */}
        <FramedPainting thumbnailUrl={thumbnailUrl} />

        {/* Dashboard */}
        {showDashboard && <RealtimeDashboard isHelpOpen={isDashboardHelpOpen} onHelpToggle={setIsDashboardHelpOpen} />}

        {/* Performance stats - Development only */}
        {isDevelopment && <Stats />}
      </Canvas>
      {/* Camera control buttons */}
      <div
        style={{
          position: "fixed",
          bottom: "32px",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: "24px",
          alignItems: "center",
          zIndex: 1000,
          pointerEvents: "none",
        }}
      >
        {/* Left button - Reset to initial painting view */}
        <button
          type="button"
          onClick={() => {
            setCurrentCameraPreset("painting");
          }}
          onPointerDown={e => {
            triggerHaptic(e);
            e.currentTarget.style.transform = "scale(0.95)";
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
          }}
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            background: "rgba(255, 255, 255, 0.08)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
            cursor: "pointer",
            pointerEvents: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            touchAction: "manipulation",
            padding: 0,
            outline: "none",
          }}
          onPointerEnter={e => {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.12)";
            e.currentTarget.style.transform = "scale(1.1)";
            e.currentTarget.style.boxShadow = "0 6px 20px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15)";
          }}
          onPointerLeave={e => {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow = "0 4px 16px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)";
          }}
          onPointerUp={e => {
            e.currentTarget.style.transform = "scale(1.1)";
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.12)";
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(255, 255, 255, 0.9)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ filter: "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3))" }}
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M9 9h6v6H9z" />
          </svg>
        </button>

        {/* Right button - Move to dashboard view */}
        <button
          type="button"
          onClick={() => {
            setCurrentCameraPreset("dashboard");
          }}
          onPointerDown={e => {
            triggerHaptic(e);
            e.currentTarget.style.transform = "scale(0.95)";
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
          }}
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            background: "rgba(255, 255, 255, 0.08)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
            cursor: "pointer",
            pointerEvents: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            touchAction: "manipulation",
            padding: 0,
            outline: "none",
          }}
          onPointerEnter={e => {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.12)";
            e.currentTarget.style.transform = "scale(1.1)";
            e.currentTarget.style.boxShadow = "0 6px 20px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15)";
          }}
          onPointerLeave={e => {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow = "0 4px 16px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)";
          }}
          onPointerUp={e => {
            e.currentTarget.style.transform = "scale(1.1)";
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.12)";
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(255, 255, 255, 0.9)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ filter: "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3))" }}
          >
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M8 10h8M8 14h6" />
          </svg>
        </button>
      </div>
    </>
  );
};
