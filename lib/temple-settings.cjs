'use strict';

const BOOLEAN_KEYS = Object.freeze(['ttsEnabled', 'bgMusicEnabled', 'sfxEnabled', 'autoSim']);
const VOLUME_KEYS = Object.freeze(['musicVolume', 'ttsVolume', 'sfxVolume']);

function normalizeTempleSettings(current = {}, update = {}) {
  const next = { ...current };
  if (!update || typeof update !== 'object' || Array.isArray(update)) return next;
  for (const key of BOOLEAN_KEYS) {
    if (typeof update[key] === 'boolean') next[key] = update[key];
  }
  for (const key of VOLUME_KEYS) {
    if (update[key] === '' || update[key] == null) continue;
    const value = Number(update[key]);
    if (Number.isFinite(value)) next[key] = Math.max(0, Math.min(1, value));
  }
  if (update.autoSimIntervalMs !== undefined) {
    const value = Number(update.autoSimIntervalMs);
    if (Number.isFinite(value)) next.autoSimIntervalMs = Math.round(Math.max(5000, Math.min(60000, value)));
  }
  if (update.smokeDensity !== undefined) {
    const value = Number(update.smokeDensity);
    if (Number.isFinite(value)) next.smokeDensity = Math.max(0, Math.min(2, value));
  }
  if (typeof update.ttsVoice === 'string' && update.ttsVoice.toLowerCase() === 'maichi') next.ttsVoice = 'maichi';
  return next;
}

module.exports = { normalizeTempleSettings };
