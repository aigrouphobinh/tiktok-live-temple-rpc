/** Pure gift-name normalization and visual action selection. */
export function normalizeGiftName(event) {
  return String(event?.giftName || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd');
}

export function resolveGiftAction(event) {
  const name = normalizeGiftName(event);
  if (/\b(rocket|ten lua)\b/.test(name)) return 'rocket';
  if (/\b(dragon|rong)\b/.test(name)) return 'dragon';
  if (/\b(donut|doughnut)\b/.test(name)) return 'donut';
  if (/\b(rose|hoa hong)\b/.test(name)) return 'rose';
  return null;
}
