'use strict';

function normalizeCommentIntentText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function classifyTempleComment(value) {
  const text = normalizeCommentIntentText(value);
  if (!text) return 'default';
  const has = (phrase) => text.includes(phrase);
  const explicitFortune = /\b(xin|gieo|rut) que\b/.test(text);
  const standaloneQue = /\bque\b/.test(text) && !/\bque huong\b/.test(text);
  if (has('xin xam') || has('gieo que') || has('rut que') || explicitFortune || standaloneQue) return 'fortune';
  if (has('chuong') || has('thinh chuong')) return 'bell';
  if (has('go mo') || has('tu kinh')) return 'woodenFish';
  if (has('thap huong') || has('dang huong') || has('bai phat') || has('lay phat')) return 'incense';
  if (has('cau ') || has('nguyen') || has('nam mo') || has('mo phat') || has('a di da') || has('binh an') || has('tai loc') || has('chuc')) return 'prayer';
  return 'default';
}

module.exports = { normalizeCommentIntentText, classifyTempleComment };
