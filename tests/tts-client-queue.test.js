import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../public/js/audio.js', import.meta.url), 'utf8');

describe('ZeroTTS client request pacing', () => {
  it('does not prefetch every queued sentence before the previous audio has played', () => {
    const enqueueStart = source.indexOf('enqueueTts(text, options = {})');
    const enqueueEnd = source.indexOf('async fetchZeroTtsAudio', enqueueStart);
    const enqueue = source.slice(enqueueStart, enqueueEnd);
    expect(enqueue).not.toContain('this.fetchZeroTtsAudio(');
    expect(enqueue).not.toContain('fetchPromise');
  });

  it('requests synthesis only after a queued sentence becomes the active playback item', () => {
    const processStart = source.indexOf('async processTtsQueue()');
    const processEnd = source.indexOf('playWavUrl(url)', processStart);
    const process = source.slice(processStart, processEnd);
    expect(process).toContain('const result = await this.fetchZeroTtsAudio(item.text, item.voice);');
    expect(process).toContain('await this.playWavUrl(audioUrl);');
  });
});
