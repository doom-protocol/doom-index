export interface OrbitControlsPoint {
  x: number;
  y: number;
  z: number;
}

export interface OrbitControlsStateLike {
  object: {
    position: OrbitControlsPoint;
  };
  target: OrbitControlsPoint;
}

export interface OrbitControlsSnapshot {
  cameraPosition: OrbitControlsPoint;
  targetPosition: OrbitControlsPoint;
}

export interface OrbitControlsBounds {
  minY: number;
  maxZ: number;
}

const cloneOrbitControlsPoint = (point: OrbitControlsPoint): OrbitControlsPoint => ({
  x: point.x,
  y: point.y,
  z: point.z,
});

const restoreOrbitControlsPoint = (target: OrbitControlsPoint, source: OrbitControlsPoint) => {
  target.x = source.x;
  target.y = source.y;
  target.z = source.z;
};

export const createOrbitControlsSnapshot = (controls: OrbitControlsStateLike): OrbitControlsSnapshot => ({
  cameraPosition: cloneOrbitControlsPoint(controls.object.position),
  targetPosition: cloneOrbitControlsPoint(controls.target),
});

export const restoreOrbitControlsSnapshot = (
  controls: OrbitControlsStateLike,
  snapshot: OrbitControlsSnapshot,
): void => {
  restoreOrbitControlsPoint(controls.object.position, snapshot.cameraPosition);
  restoreOrbitControlsPoint(controls.target, snapshot.targetPosition);
};

export const isOrbitControlsWithinBounds = (controls: OrbitControlsStateLike, bounds: OrbitControlsBounds): boolean =>
  Math.min(controls.object.position.y, controls.target.y) >= bounds.minY &&
  Math.max(controls.object.position.z, controls.target.z) <= bounds.maxZ &&
  controls.object.position.z <= controls.target.z;
