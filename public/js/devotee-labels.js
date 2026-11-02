export const DEFAULT_DEVOTEE_PRAYER_LABEL = 'Nguyện cầu gia đình bình an';
export const DEFAULT_DEVOTEE_PRAYER_MAX_LENGTH = 28;

/**
 * Normalize a viewer prayer into a short, readable 3D label.
 * Keep the ellipsis inside the character budget and avoid splitting composed
 * Vietnamese characters by normalizing to NFC before counting code points.
 */
export function formatDevoteePrayerLabel(value, maxLength = DEFAULT_DEVOTEE_PRAYER_MAX_LENGTH) {
  const normalized = typeof value === 'string'
    ? value.normalize('NFC').replace(/\\s+/gu, ' ').trim()
    : '';
  const prayer = normalized || DEFAULT_DEVOTEE_PRAYER_LABEL;
  const limit = Number.isInteger(maxLength) && maxLength >= 4
    ? maxLength
    : DEFAULT_DEVOTEE_PRAYER_MAX_LENGTH;
  const characters = Array.from(prayer);
  if (characters.length <= limit) return prayer;
  return `${characters.slice(0, limit - 1).join('').trimEnd()}…`;
}
