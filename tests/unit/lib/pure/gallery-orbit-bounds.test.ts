import { describe, expect, it } from "bun:test";
import {
  constrainOrbitControlsSnapshot,
  createOrbitControlsSnapshot,
  isOrbitControlsWithinBounds,
  restoreOrbitControlsSnapshot,
} from "@/lib/pure/gallery-orbit-bounds";
import type { OrbitControlsBounds, OrbitControlsStateLike } from "@/lib/pure/gallery-orbit-bounds";

const BOUNDS: OrbitControlsBounds = {
  minY: 0,
  maxZ: 4.98,
};

const createControls = (): OrbitControlsStateLike => ({
  object: {
    position: {
      x: 0,
      y: 0.8,
      z: 0.8,
    },
  },
  target: {
    x: 0,
    y: 0.8,
    z: 4.0,
  },
});

describe("unit/lib/pure/gallery-orbit-bounds", () => {
  it("accepts controls within the allowed volume", () => {
    expect(isOrbitControlsWithinBounds(createControls(), BOUNDS)).toBe(true);
  });

  it("rejects controls below the floor", () => {
    const controls = createControls();
    controls.target.y = -0.1;

    expect(isOrbitControlsWithinBounds(controls, BOUNDS)).toBe(false);
  });

  it("rejects controls beyond the back wall", () => {
    const controls = createControls();
    controls.target.z = 5.1;

    expect(isOrbitControlsWithinBounds(controls, BOUNDS)).toBe(false);
  });

  it("clamps floor overflow by lifting camera and target together", () => {
    const controls = createControls();
    controls.object.position.x = 0.6;
    controls.object.position.y = 0.05;
    controls.object.position.z = 1.6;
    controls.target.x = 0.65;
    controls.target.y = -0.25;
    controls.target.z = 4.7;

    expect(constrainOrbitControlsSnapshot(controls, BOUNDS)).toEqual({
      cameraPosition: {
        x: 0.6,
        y: 0.3,
        z: 1.6,
      },
      targetPosition: {
        x: 0.65,
        y: 0,
        z: 4.7,
      },
    });
  });

  it("clamps back-wall overflow by moving camera and target forward together", () => {
    const controls = createControls();
    controls.object.position.x = 0.25;
    controls.object.position.y = 0.3;
    controls.object.position.z = 5.2;
    controls.target.x = 0.3;
    controls.target.y = 0.45;
    controls.target.z = 5.3;

    const constrained = constrainOrbitControlsSnapshot(controls, BOUNDS);

    expect(constrained.cameraPosition.x).toBe(0.25);
    expect(constrained.cameraPosition.y).toBe(0.3);
    expect(constrained.cameraPosition.z).toBeCloseTo(4.88, 10);
    expect(constrained.targetPosition.x).toBe(0.3);
    expect(constrained.targetPosition.y).toBe(0.45);
    expect(constrained.targetPosition.z).toBeCloseTo(4.98, 10);
  });

  it("restores the captured snapshot", () => {
    const controls = createControls();
    const snapshot = createOrbitControlsSnapshot(controls);

    controls.object.position.x = 1;
    controls.object.position.y = -1;
    controls.object.position.z = 5;
    controls.target.x = 2;
    controls.target.y = -2;
    controls.target.z = 6;

    restoreOrbitControlsSnapshot(controls, snapshot);

    expect(controls).toEqual(createControls());
  });
});
