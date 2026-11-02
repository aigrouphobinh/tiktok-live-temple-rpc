import { describe, expect, it } from 'bun:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { normalizeTempleSettings } = require('../lib/temple-settings.cjs');

describe('Temple settings validation', () => {
  it('clamps persistent audio toggles and volumes', () => {
    expect(normalizeTempleSettings({}, {
      ttsEnabled: false, bgMusicEnabled: false, sfxEnabled: true,
      musicVolume: 0.4, ttsVolume: 1.5, sfxVolume: -2
    })).toMatchObject({
      ttsEnabled: false, bgMusicEnabled: false, sfxEnabled: true,
      musicVolume: 0.4, ttsVolume: 1, sfxVolume: 0
    });
  });
  it('clamps auto simulation interval and smoke density', () => {
    expect(normalizeTempleSettings({}, {
      autoSim: true, autoSimIntervalMs: 1, smokeDensity: 8
    })).toMatchObject({ autoSim: true, autoSimIntervalMs: 5000, smokeDensity: 2 });
  });
  it('ignores invalid types and unsupported keys', () => {
    expect(normalizeTempleSettings({ ttsEnabled: true, musicVolume: 0.65 }, {
      ttsEnabled: 'false', musicVolume: Infinity, admin: true, ttsVoice: 'unknown'
    })).toEqual({ ttsEnabled: true, musicVolume: 0.65 });
  });
});
