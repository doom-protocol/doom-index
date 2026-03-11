import { describe, expect, it } from "bun:test";
import {
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
    controls.object.position.y = -0.1;

    expect(isOrbitControlsWithinBounds(controls, BOUNDS)).toBe(false);
  });

  it("rejects controls beyond the back wall", () => {
    const controls = createControls();
    controls.target.z = 5.1;

    expect(isOrbitControlsWithinBounds(controls, BOUNDS)).toBe(false);
  });

  it("rejects controls when the camera moves behind the target", () => {
    const controls = createControls();
    controls.object.position.z = 4.2;
    controls.target.z = 4.0;

    expect(isOrbitControlsWithinBounds(controls, BOUNDS)).toBe(false);
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
