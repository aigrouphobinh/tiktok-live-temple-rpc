import { describe, expect, it } from 'bun:test';
import { dispatchGiftSfx } from '../public/js/gift-sfx-dispatcher.js';

describe('dispatchGiftSfx', () => {
  it('routes each supported gift sound to its dedicated audio method', () => {
    const calls = [];
    const audio = Object.fromEntries([
      'playRocketLaunch', 'playExplosion', 'playDragonWhoosh',
      'playDragonRoar', 'playDonutChime', 'playRoseChime'
    ].map((name) => [name, (...args) => calls.push([name, ...args])]));

    for (const type of [
      'rocket-launch', 'explosion', 'dragon-whoosh',
      'dragon-roar', 'donut-chime', 'rose-chime'
    ]) expect(dispatchGiftSfx(audio, type)).toBe(true);

    expect(calls).toEqual([
      ['playRocketLaunch'],
      ['playExplosion', 1],
      ['playDragonWhoosh'],
      ['playDragonRoar'],
      ['playDonutChime'],
      ['playRoseChime']
    ]);
  });

  it('ignores unknown sound names without invoking audio methods', () => {
    let called = false;
    expect(dispatchGiftSfx({ playRocketLaunch: () => { called = true; } }, 'rocket')).toBe(false);
    expect(called).toBe(false);
  });

  it('safely ignores missing audio engines and unavailable methods', () => {
    expect(dispatchGiftSfx(null, 'rocket-launch')).toBe(false);
    expect(dispatchGiftSfx({}, 'rose-chime')).toBe(false);
  });
});
