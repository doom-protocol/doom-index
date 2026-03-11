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

export const constrainOrbitControlsSnapshot = (
  controls: OrbitControlsStateLike,
  bounds: OrbitControlsBounds,
): OrbitControlsSnapshot => {
  const snapshot = createOrbitControlsSnapshot(controls);
  const floorOverflow = bounds.minY - snapshot.targetPosition.y;

  if (floorOverflow > 0) {
    snapshot.cameraPosition.y += floorOverflow;
    snapshot.targetPosition.y = bounds.minY;
  }

  const backWallOverflow = snapshot.targetPosition.z - bounds.maxZ;
  if (backWallOverflow > 0) {
    snapshot.cameraPosition.z -= backWallOverflow;
    snapshot.targetPosition.z = bounds.maxZ;
  }

  return snapshot;
};

export const isOrbitControlsWithinBounds = (controls: OrbitControlsStateLike, bounds: OrbitControlsBounds): boolean =>
  controls.target.y >= bounds.minY && controls.target.z <= bounds.maxZ;
