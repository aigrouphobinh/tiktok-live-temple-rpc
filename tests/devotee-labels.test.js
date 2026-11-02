import { describe, expect, it } from 'bun:test';
import {
  DEFAULT_DEVOTEE_PRAYER_LABEL,
  formatDevoteePrayerLabel
} from '../public/js/devotee-labels.js';

describe('3D devotee prayer labels', () => {
  it('uses a calm default when the viewer has not supplied a prayer', () => {
    expect(formatDevoteePrayerLabel()).toBe(DEFAULT_DEVOTEE_PRAYER_LABEL);
    expect(formatDevoteePrayerLabel('   ')).toBe(DEFAULT_DEVOTEE_PRAYER_LABEL);
    expect(formatDevoteePrayerLabel(null)).toBe(DEFAULT_DEVOTEE_PRAYER_LABEL);
  });

  it('normalizes whitespace without changing the prayer wording', () => {
    expect(formatDevoteePrayerLabel('  Nguyện cầu   gia đình bình an  '))
      .toBe('Nguyện cầu gia đình bình an');
  });

  it('keeps short Vietnamese prayers intact', () => {
    const prayer = 'Nguyện cầu gia đình bình an';
    expect(formatDevoteePrayerLabel(prayer)).toBe(prayer);
  });

  it('truncates long prayers with an ellipsis within the configured limit', () => {
    const label = formatDevoteePrayerLabel(
      'Nguyện cầu gia đình bình an, vạn sự cát tường, sức khỏe dồi dào',
      24
    );
    expect(Array.from(label)).toHaveLength(24);
    expect(label.endsWith('…')).toBe(true);
    expect(label.startsWith('Nguyện cầu gia đình')).toBe(true);
  });

  it('falls back to the standard limit for invalid limits', () => {
    const prayer = 'Nguyện cầu gia đình bình an, vạn sự cát tường, sức khỏe dồi dào';
    expect(formatDevoteePrayerLabel(prayer, 2)).toBe(formatDevoteePrayerLabel(prayer));
  });
});
