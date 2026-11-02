import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { getAoDaiAppearance } from '../public/js/ao-dai-avatar.js';

describe('Vietnamese Ao Dai devotee appearance selection', () => {
  it('alternates male and female visitors in a stable sequence', () => {
    expect(getAoDaiAppearance(0)).toMatchObject({ gender: 'male', sequence: 0 });
    expect(getAoDaiAppearance(1)).toMatchObject({ gender: 'female', sequence: 1 });
    expect(getAoDaiAppearance(2)).toMatchObject({ gender: 'male', sequence: 2 });
    expect(getAoDaiAppearance(3)).toMatchObject({ gender: 'female', sequence: 3 });
  });

  it('keeps colour palettes bounded and cycles through the formal Ao Dai palette', () => {
    const paletteIndices = Array.from({ length: 12 }, (_, index) => getAoDaiAppearance(index).paletteIndex);
    expect(paletteIndices).toEqual([0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 5]);
  });

  it('defaults malformed appearance indices to the first male look', () => {
    expect(getAoDaiAppearance(-1)).toMatchObject({ gender: 'male', paletteIndex: 0, sequence: 0 });
    expect(getAoDaiAppearance(2.5)).toMatchObject({ gender: 'male', paletteIndex: 0, sequence: 0 });
  });

  it('defines the complete long-tunic silhouette and split front/back panels', () => {
    const source = readFileSync(new URL('../public/js/ao-dai-avatar.js', import.meta.url), 'utf8');
    expect(source).toContain('AoDaiLongTunic');
    expect(source).toContain('AoDaiFrontLeft');
    expect(source).toContain('AoDaiFrontRight');
    expect(source).toContain('AoDaiBackLeft');
    expect(source).toContain('AoDaiBackRight');
    expect(source).toContain('AoDaiHighCollar');
    expect(source).toContain('AoDaiGoldHem');
    expect(source).toContain('const leftArm = new THREE.Group()');
    expect(source).toContain('const leftLeg = new THREE.Group()');
    // Every geometry helper call must receive the active Three.js namespace;
    // omitting it turns the geometry cache's WeakMap key into a number.
    expect(source.match(/cylinderGeometry\\((?!THREE\\b)/g) || []).toHaveLength(0);
    expect(source.match(/sphereGeometry\\((?!THREE\\b)/g) || []).toHaveLength(0);
    expect(source).toContain("normalizedGender === 'female'");
    expect(source).toContain("normalizedGender === 'male'");
  });
});
