import { describe, expect, it } from 'bun:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { normalizeGiftPayload, getGiftComboDelta } = require('../lib/tiktok-gift-payload.cjs');

describe('TikTok gift payload normalization', () => {
  it('reads the documented giftDetails.giftName shape without inventing an ID', () => {
    const payload = normalizeGiftPayload({
      giftId: 5655,
      giftDetails: { giftName: 'Rose', diamondCount: 1, giftType: 1 },
      repeatCount: 2,
      repeatEnd: false
    }, 'viewer');

    expect(payload).toMatchObject({
      giftId: '5655',
      giftName: 'Rose',
      diamondCount: 1,
      repeatCount: 2,
      repeatEnd: false,
      streakable: true,
      groupId: 'viewer|5655'
    });
  });

  it('supports the newer gift.name shape and extended gift metadata', () => {
    expect(normalizeGiftPayload({
      gift: { id: '777', name: 'Rocket', diamondCount: 20, type: 0 }
    }, 'viewer')).toMatchObject({ giftId: '777', giftName: 'Rocket', diamondCount: 20, streakable: false });

    expect(normalizeGiftPayload({
      giftId: 888,
      extendedGiftInfo: { name: 'Dragon', diamondCount: 500 }
    }, 'viewer')).toMatchObject({ giftId: '888', giftName: 'Dragon', diamondCount: 500 });
  });

  it('uses gift name in fallback combo identity when TikTok omits giftId and groupId', () => {
    const payload = normalizeGiftPayload({
      giftDetails: { giftName: 'Donut', diamondCount: 30, giftType: 1 },
      repeatCount: 1
    }, 'viewer');

    expect(payload.giftId).toBe('');
    expect(payload.groupId).toBe('viewer|Donut');
  });

  it('counts cumulative streak updates incrementally and clears on final frame', () => {
    const tracker = new Map();
    const base = { groupId: 'viewer|5655', streakable: true };

    expect(getGiftComboDelta(tracker, { ...base, repeatCount: 1, repeatEnd: false })).toBe(1);
    expect(getGiftComboDelta(tracker, { ...base, repeatCount: 3, repeatEnd: false })).toBe(2);
    expect(getGiftComboDelta(tracker, { ...base, repeatCount: 3, repeatEnd: true })).toBe(0);
    expect(tracker.has(base.groupId)).toBe(false);
    expect(getGiftComboDelta(tracker, { ...base, repeatCount: 3, repeatEnd: true })).toBe(0);
  });

  it('does not retain state for non-streakable gifts', () => {
    const tracker = new Map();
    expect(getGiftComboDelta(tracker, {
      groupId: 'viewer|rocket', repeatCount: 1, repeatEnd: false, streakable: false
    })).toBe(1);
    expect(tracker.size).toBe(0);
  });
});
