export function getFootPlantingPose(phase) {
  const cycle = ((phase % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const stance = 0.62;
  const progress = cycle / (Math.PI * 2);
  if (progress < stance) {
    return {
      step: -1 + 2 * (progress / stance),
      kneeFlex: 0.035,
      footLift: 0,
      swingProgress: 0,
      stanceProgress: progress / stance,
      isStance: true
    };
  }
  const swingProgress = (progress - stance) / (1 - stance);
  const eased = swingProgress * swingProgress * (3 - 2 * swingProgress);
  return {
    step: 1 - 2 * eased,
    kneeFlex: Math.sin(Math.PI * swingProgress) * 0.72,
    footLift: Math.sin(Math.PI * swingProgress) * 0.13,
    swingProgress,
    stanceProgress: 0,
    isStance: false
  };
}

export function getFootPlantingStep(phase) {
  return getFootPlantingPose(phase).step;
}

/**
 * Solve a two-segment limb in world space using the law of cosines.
 * Vectors are [x, y, z]. The pole point selects which side the joint bends to.
 * Returns null for invalid inputs; unreachable targets are clamped safely.
 */
export function solveTwoBoneIK({ root, target, pole, upperLength, lowerLength }) {
  const vectorIsFinite = (value) => Array.isArray(value) && value.length === 3
    && value.every(Number.isFinite);
  if (!vectorIsFinite(root) || !vectorIsFinite(target) || !vectorIsFinite(pole)
    || !Number.isFinite(upperLength) || !Number.isFinite(lowerLength)
    || upperLength <= 0 || lowerLength <= 0) return null;

  const subtract = (a, b) => a.map((value, index) => value - b[index]);
  const addScaled = (a, b, scale) => a.map((value, index) => value + b[index] * scale);
  const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
  const length = (value) => Math.sqrt(dot(value, value));
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
  const safeNormalize = (value, fallback) => {
    const magnitude = length(value);
    return magnitude > 1e-8 ? value.map((part) => part / magnitude) : fallback;
  };

  const toTarget = subtract(target, root);
  const rawDistance = length(toTarget);
  const direction = safeNormalize(toTarget, [0, -1, 0]);
  const minReach = Math.abs(upperLength - lowerLength) + 1e-6;
  const maxReach = upperLength + lowerLength - 1e-6;
  const distance = Math.min(maxReach, Math.max(minReach, rawDistance));
  const solvedTarget = addScaled(root, direction, distance);

  let bend = subtract(pole, root);
  bend = subtract(bend, direction.map((part) => part * dot(bend, direction)));
  if (length(bend) <= 1e-8) {
    const fallbackAxis = Math.abs(direction[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    bend = cross(direction, fallbackAxis);
  }
  bend = safeNormalize(bend, [1, 0, 0]);

  const along = (upperLength * upperLength - lowerLength * lowerLength + distance * distance)
    / (2 * distance);
  const height = Math.sqrt(Math.max(0, upperLength * upperLength - along * along));
  const knee = addScaled(addScaled(root, direction, along), bend, height);

  return {
    root: [...root],
    knee,
    target: solvedTarget,
    requestedTarget: [...target],
    distance,
    reachable: Math.abs(distance - rawDistance) < 1e-7
  };
}

/**
 * Produce a world-space foot target and immutable stance-lock state.
 * hip, strideDirection and targets use [x, y, z] world coordinates.
 */
export function getFootPlantingWorldTarget({
  phase, hip, strideDirection, strideLength, groundY, lockState = null
}) {
  const validVector = (value) => Array.isArray(value) && value.length === 3
    && value.every(Number.isFinite);
  if (!Number.isFinite(phase) || !validVector(hip) || !validVector(strideDirection)
    || !Number.isFinite(strideLength) || strideLength < 0 || !Number.isFinite(groundY)) return null;

  const horizontal = [strideDirection[0], 0, strideDirection[2]];
  const magnitude = Math.hypot(horizontal[0], horizontal[2]);
  if (magnitude <= 1e-8) return null;
  const direction = [horizontal[0] / magnitude, 0, horizontal[2] / magnitude];
  const pose = getFootPlantingPose(phase);
  const offset = pose.step * strideLength * 0.5;
  const swingTarget = [
    hip[0] + direction[0] * offset,
    groundY + pose.footLift,
    hip[2] + direction[2] * offset
  ];

  if (pose.isStance) {
    const canKeepLock = lockState?.wasStance === true
      && validVector(lockState.lockedTarget);
    const lockedTarget = canKeepLock ? [...lockState.lockedTarget] : [
      swingTarget[0], groundY, swingTarget[2]
    ];
    return {
      target: lockedTarget,
      planted: true,
      pose,
      lockState: { wasStance: true, lockedTarget }
    };
  }

  return {
    target: swingTarget,
    planted: false,
    pose,
    lockState: { wasStance: false, lockedTarget: null }
  };
}
