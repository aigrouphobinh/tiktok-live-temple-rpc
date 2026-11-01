import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');

describe('Three.js scene performance safeguards', () => {
  it('limits decorative lantern point lights to two per aisle', () => {
    expect(source).toContain('for (const x of [-5.8, 5.8])');
    expect(source).toContain('for (const z of [-7, -1, 5, 11])');
    expect(source).toContain('if (z === -7 || z === 5)');
    expect(source).toContain('lanterns.push(light);');
  });

  it('bounds concurrent transient gift and ritual effects and disposes evictions', () => {
    expect(source).toContain('const MAX_EFFECTS = 64;');
    expect(source).toContain('if (effects.length >= MAX_EFFECTS)');
    expect(source).toContain('world.remove(old.object); disposeThreeObjectTree(old.object);');
  });

  it('keeps the fixed elevated portrait camera and 30fps frame cap', () => {
    expect(source).toContain('camera.position.set(0, 10.5, 23);');
    expect(source).toContain('camera.lookAt(0, 4.4, -5.5);');
    expect(source).toContain('if (now - lastFrame < 33) return;');
  });
  it('adapts render pixel ratio to device capacity without exceeding 1.25x', async () => {
    const { getTemplePixelRatio } = await import('../public/js/temple-render-quality.js');
    expect(getTemplePixelRatio({ devicePixelRatio: 2, deviceMemory: 4, hardwareConcurrency: 8 })).toBe(1);
    expect(getTemplePixelRatio({ devicePixelRatio: 2, deviceMemory: 8, hardwareConcurrency: 8 })).toBe(1.25);
    expect(getTemplePixelRatio({ devicePixelRatio: 1, deviceMemory: 8, hardwareConcurrency: 8 })).toBe(1);
    expect(getTemplePixelRatio({ devicePixelRatio: 2, hardwareConcurrency: 8 })).toBe(1.25);
    expect(getTemplePixelRatio({ devicePixelRatio: 2, deviceMemory: 8, hardwareConcurrency: 2 })).toBe(1);
  });

  it('keeps the sanctuary roofless and preserves the open altar sightline', () => {
    expect(source).not.toMatch(/makeCurvedRoofSide|roofTile|roofTrim|roofStartZ|const ridge =/);
    expect(source).toContain('Open-air sanctuary: keep the upper sightline clear');
    expect(source).toContain('camera.lookAt(0, 4.4, -5.5);');
  });

});
