import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';

const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
const engine = readFileSync(new URL('../public/js/gift-action-engine.js', import.meta.url), 'utf8');

describe('Ritual visit timing', () => {
  it('allows a natural entrance, approach and three bows before releasing the altar', () => {
    expect(scene).toContain("setDevoteePhase('enter', now, 3600);");
    expect(scene).toContain("setDevoteePhase('queue', now, 350);");
    expect(scene).toContain("setDevoteePhase('approach', now, 4200);");
    expect(scene).toContain('bowCycles: 3,');
    expect(scene).toContain('bowCycleMs: 1050,');
    expect(engine).toContain("event?.type === 'drawFortune' ? 18000 : 12500");
  });

  it('keeps the first visitor on the same side entrance as the visible queue', () => {
    expect(scene).toContain('mainDevotee.position.copy(queueStart || new THREE.Vector3(-4.55, 0.05, 15.3));');
    expect(scene).toContain("enter: [[-4.55, 0, 15.3], [-4.2, 0, 13.8], [-3.85, 0, 10.8], [-3.65, 0, 8.0]]");
    expect(scene).toContain('actor.target.set(-4.55, 0.05, 8.0 + index * 1.45);');
  });
});
