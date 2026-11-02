const { describe, expect, it } = require('bun:test');
const { TEST_PRESETS, buildEffectTestPayload } = require('../lib/effect-test-presets.cjs');

describe('control-panel effect test presets', () => {
  it('exposes the complete ritual and gift effect test set', () => {
    expect(Object.keys(TEST_PRESETS)).toEqual([
      'incense', 'lantern', 'woodenFish', 'bell', 'fortune',
      'lotusGift', 'rocket', 'dragon', 'donut', 'rose', 'grand'
    ]);
  });

  it('builds no-target gift tests without creating a server-side reward event', () => {
    for (const effect of ['rocket', 'dragon', 'donut', 'rose', 'grand']) {
      const payload = buildEffectTestPayload(effect);
      expect(payload.events).toHaveLength(1);
      expect(payload.events[0]).toMatchObject({
        testOnly: true,
        merit: 0,
        ttsText: ''
      });
      expect(payload.withTarget).toBe(false);
    }
  });

  it('seeds a temporary worshipper before targeted gift tests', () => {
    for (const effect of ['rocket', 'dragon', 'donut', 'rose', 'grand']) {
      const payload = buildEffectTestPayload(effect, { withTarget: true });
      expect(payload.events).toHaveLength(2);
      expect(payload.events[0]).toMatchObject({
        type: 'burnIncense',
        testOnly: true,
        testSeed: true,
        merit: 0
      });
      expect(payload.events[1]).toMatchObject({
        testOnly: true,
        merit: 0
      });
    }
  });

  it('marks special-grand tests as a high-tier gift for the halo reaction', () => {
    const payload = buildEffectTestPayload('grand');
    expect(payload.events[0]).toMatchObject({
      type: 'grandCeremony',
      diamondCount: 1000,
      giftName: 'Đại Lễ Kim Long (Dragon)'
    });
  });

  it('provides a fortune record for the complete fortune modal test', () => {
    const payload = buildEffectTestPayload('fortune');
    expect(payload.events[0].fortune).toMatchObject({
      number: 1,
      rank: 'Thượng Thượng Cát'
    });
  });

  it('rejects unsupported test names', () => {
    expect(() => buildEffectTestPayload('deleteState')).toThrow('không hợp lệ');
    expect(() => buildEffectTestPayload('')).toThrow();
  });
});
