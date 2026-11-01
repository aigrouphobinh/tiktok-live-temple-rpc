import { describe, expect, it } from 'bun:test';
import { getFootPlantingPose, getFootPlantingStep, getFootPlantingWorldTarget, solveTwoBoneIK } from '../public/js/three-gait-utils.js';

describe('getFootPlantingStep', () => {
  const tau = Math.PI * 2;
  const stance = 0.62;

  it('moves the planted foot steadily from rear to front during stance', () => {
    expect(getFootPlantingStep(0)).toBeCloseTo(-1, 8);
    expect(getFootPlantingStep(tau * stance * 0.5)).toBeCloseTo(0, 8);
    expect(getFootPlantingStep(tau * stance)).toBeCloseTo(1, 8);
  });

  it('returns the foot smoothly toward the rear during swing', () => {
    expect(getFootPlantingStep(tau * (stance + (1 - stance) * 0.5))).toBeCloseTo(0, 8);
    expect(getFootPlantingStep(tau)).toBeCloseTo(-1, 8);
  });

  it('wraps negative and repeated phases into the same gait cycle', () => {
    expect(getFootPlantingStep(-tau * 0.25)).toBeCloseTo(getFootPlantingStep(tau * 0.75), 8);
    expect(getFootPlantingStep(tau * 2.25)).toBeCloseTo(getFootPlantingStep(tau * 0.25), 8);
  });
});

describe('getFootPlantingPose', () => {
  const tau = Math.PI * 2;
  const stance = 0.62;

  it('keeps the knee nearly straight and foot grounded during stance', () => {
    const pose = getFootPlantingPose(tau * stance * 0.5);
    expect(pose.kneeFlex).toBeCloseTo(0.035, 8);
    expect(pose.footLift).toBe(0);
    expect(pose.swingProgress).toBe(0);
  });

  it('flexes the knee and lifts the foot through the swing arc', () => {
    const pose = getFootPlantingPose(tau * (stance + (1 - stance) * 0.5));
    expect(pose.kneeFlex).toBeCloseTo(0.72, 8);
    expect(pose.footLift).toBeCloseTo(0.13, 8);
    expect(pose.swingProgress).toBeCloseTo(0.5, 8);
  });

  it('returns to the grounded pose at the next cycle boundary', () => {
    const pose = getFootPlantingPose(tau);
    expect(pose.kneeFlex).toBeCloseTo(0.035, 8);
    expect(pose.footLift).toBe(0);
  });
});

describe('solveTwoBoneIK', () => {
  const lengths = { upperLength: 2, lowerLength: 2 };

  it('places the joint at equal distance from both segment endpoints', () => {
    const result = solveTwoBoneIK({
      root: [0, 0, 0], target: [0, -3, 0], pole: [1, 0, 0], ...lengths
    });
    const distance = (a, b) => Math.hypot(...a.map((value, index) => value - b[index]));
    expect(result).not.toBeNull();
    expect(distance(result.root, result.knee)).toBeCloseTo(2, 8);
    expect(distance(result.knee, result.target)).toBeCloseTo(2, 8);
    expect(result.target).toEqual([0, -3, 0]);
    expect(result.reachable).toBe(true);
  });

  it('uses the pole point to choose a stable bend direction', () => {
    const result = solveTwoBoneIK({
      root: [0, 0, 0], target: [0, -3, 0], pole: [-2, 0, 0], ...lengths
    });
    expect(result.knee[0]).toBeLessThan(0);
    expect(result.knee.every(Number.isFinite)).toBe(true);
  });

  it('clamps targets beyond maximum reach without producing invalid coordinates', () => {
    const result = solveTwoBoneIK({
      root: [0, 0, 0], target: [0, -8, 0], pole: [1, 0, 0], ...lengths
    });
    expect(result.reachable).toBe(false);
    expect(Math.hypot(...result.target)).toBeCloseTo(4 - 1e-6, 7);
    expect(result.knee.every(Number.isFinite)).toBe(true);
  });

  it('handles a zero-distance target and a collinear pole safely', () => {
    const result = solveTwoBoneIK({
      root: [1, 2, 3], target: [1, 2, 3], pole: [1, 4, 3], ...lengths
    });
    expect(result).not.toBeNull();
    expect(result.reachable).toBe(false);
    expect(result.knee.every(Number.isFinite)).toBe(true);
  });

  it('rejects missing vectors and invalid segment lengths', () => {
    expect(solveTwoBoneIK({ root: [0, 0, 0], target: [0, 1, 0], pole: [1, 0, 0], upperLength: 0, lowerLength: 1 })).toBeNull();
    expect(solveTwoBoneIK({ root: [0, 0], target: [0, 1, 0], pole: [1, 0, 0], ...lengths })).toBeNull();
  });
});

describe('getFootPlantingWorldTarget', () => {
  const tau = Math.PI * 2;
  const stanceEnd = 0.62;

  it('captures a world-space target at stance start and holds it as the hip moves', () => {
    const first = getFootPlantingWorldTarget({
      phase: 0, hip: [0, 1, 0], strideDirection: [0, 0, -1],
      strideLength: 2, groundY: 0
    });
    const moved = getFootPlantingWorldTarget({
      phase: tau * 0.3, hip: [0, 1, -0.8], strideDirection: [0, 0, -1],
      strideLength: 2, groundY: 0, lockState: first.lockState
    });
    expect(first.planted).toBe(true);
    expect(moved.planted).toBe(true);
    expect(moved.target).toEqual(first.target);
    expect(moved.target[1]).toBe(0);
  });

  it('releases the stance lock during swing and follows the moving hip', () => {
    const stance = getFootPlantingWorldTarget({
      phase: 0, hip: [0, 1, 0], strideDirection: [0, 0, -1],
      strideLength: 2, groundY: 0
    });
    const swing = getFootPlantingWorldTarget({
      phase: tau * (stanceEnd + 0.5 * (1 - stanceEnd)),
      hip: [0, 1, -1], strideDirection: [0, 0, -1],
      strideLength: 2, groundY: 0, lockState: stance.lockState
    });
    expect(swing.planted).toBe(false);
    expect(swing.lockState.lockedTarget).toBeNull();
    expect(swing.target[2]).toBeCloseTo(-1, 8);
    expect(swing.target[1]).toBeCloseTo(0.13, 8);
  });

  it('captures a fresh target on the next stance after releasing the old lock', () => {
    const swing = getFootPlantingWorldTarget({
      phase: tau * 0.8, hip: [0, 1, -1], strideDirection: [0, 0, -1],
      strideLength: 2, groundY: 0,
      lockState: { wasStance: false, lockedTarget: null }
    });
    const next = getFootPlantingWorldTarget({
      phase: tau, hip: [0, 1, -2], strideDirection: [0, 0, -1],
      strideLength: 2, groundY: 0, lockState: swing.lockState
    });
    expect(next.planted).toBe(true);
    expect(next.target[2]).toBeCloseTo(-3, 8);
  });

  it('rejects invalid world-space inputs and zero horizontal direction', () => {
    expect(getFootPlantingWorldTarget({
      phase: 0, hip: [0, 1, 0], strideDirection: [0, 1, 0],
      strideLength: 1, groundY: 0
    })).toBeNull();
    expect(getFootPlantingWorldTarget({
      phase: 0, hip: [0, 1], strideDirection: [0, 0, -1],
      strideLength: 1, groundY: 0
    })).toBeNull();
  });
});
