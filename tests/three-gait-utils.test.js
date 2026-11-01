import { describe, expect, it } from 'bun:test';
import { getFootPlantingStep } from '../public/js/three-gait-utils.js';

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
