import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';

const engine = readFileSync(new URL('../public/js/gift-action-engine.js', import.meta.url), 'utf8');
const live = readFileSync(new URL('../public/js/live.js', import.meta.url), 'utf8');

describe('Rocket and Donut 2D target ejection', () => {
  it('moves the central visitor offstage only when a target was actually interrupted', () => {
    const rocketStart = engine.indexOf('function playRocket(token, hasTarget = false)');
    const rocketEnd = engine.indexOf('function playDragon(token)', rocketStart);
    const rocket = engine.slice(rocketStart, rocketEnd);
    const donutStart = engine.indexOf('function playDonut(token, hasTarget = false)');
    const donutEnd = engine.indexOf('function showActionLabel(action)', donutStart);
    const donut = engine.slice(donutStart, donutEnd);

    expect(rocket).toContain('if (hasTarget)');
    expect(rocket).toContain('translate3d(700px,-560px,0)');
    expect(rocket).toContain('hideCentralCharacterAfter(token, 1160)');
    expect(donut).toContain('if (hasTarget)');
    expect(donut).toContain('translate3d(690px,118px,0)');
    expect(donut).toContain('hideCentralCharacterAfter(token, 2520)');
  });

  it('uses the state machine ejection result for the active and chained effect', () => {
    expect(engine).toContain('const targetEjected = Boolean(result.ejectedDevotee)');
    expect(engine).toContain('targetEjected: Boolean(result.ejectedDevotee)');
    expect(engine).toContain('effectDurationMs: EFFECT_DURATION[action] || 3500');
    expect(engine).toContain("new CustomEvent('temple:gift-effects-complete'");
  });

  it('makes the next worshipper visible again when their turn starts', () => {
    const start = live.indexOf('function animateWalkerOnCarpet(');
    const end = live.indexOf('function updateCentralWorshipper(', start);
    const walker = live.slice(start, end);
    expect(walker).toContain("spriteStack.style.visibility = 'visible'");
  });
});
