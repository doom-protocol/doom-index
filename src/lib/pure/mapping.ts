import type { NormalizedMcMap } from "@/constants/token";
import { clamp01 } from "./normalize";

const ease = (value: number, power: number): number => clamp01(Math.pow(clamp01(value), power));

const lift = (value: number, base: number, scale: number): number => clamp01(base + clamp01(value) * scale);

export type VisualParams = {
  fogDensity: number;
  skyTint: number;
  reflectivity: number;
  blueBalance: number;
  vegetationDensity: number;
  organicPattern: number;
  radiationGlow: number;
  debrisIntensity: number;
  mechanicalPattern: number;
  metallicRatio: number;
  fractalDensity: number;
  bioluminescence: number;
  shadowDepth: number;
  redHighlight: number;
  lightIntensity: number;
  warmHue: number;
};

export function mapToVisualParams(normalized: NormalizedMcMap): VisualParams {
  return {
    fogDensity: ease(normalized.CO2, 0.65),
    skyTint: lift(normalized.CO2, 0.15, 0.75),
    reflectivity: ease(normalized.ICE, 0.7),
    blueBalance: lift(normalized.ICE, 0.4, 0.5),
    vegetationDensity: ease(normalized.FOREST, 0.8),
    organicPattern: lift(normalized.FOREST, 0.3, 0.6),
    radiationGlow: ease(normalized.NUKE, 0.6),
    debrisIntensity: lift(normalized.NUKE, 0.2, 0.75),
    mechanicalPattern: clamp01(normalized.MACHINE),
    metallicRatio: lift(normalized.MACHINE, 0.3, 0.6),
    fractalDensity: clamp01(normalized.PANDEMIC),
    bioluminescence: lift(normalized.PANDEMIC, 0.2, 0.7),
    shadowDepth: ease(normalized.FEAR, 0.8),
    redHighlight: lift(normalized.FEAR, 0.3, 0.6),
    lightIntensity: ease(normalized.HOPE, 0.9),
    warmHue: lift(normalized.HOPE, 0.4, 0.5),
  };
}
