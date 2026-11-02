import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../tts_worker.py', import.meta.url), 'utf8');

describe('ZeroTTS long text handling', () => {
  it('segments long utterances using the official ZeroTTS chunking helpers', () => {
    expect(source).toContain('from zerotts.chunking import clean_segment_punctuation, chunk_text, normalize_punctuation');
    expect(source).toContain('chunk_text(normalize_punctuation(text), max_chunk_sec=15)');
    expect(source).toContain('for index, segment in enumerate(segments):');
    expect(source).toContain('np.concatenate(audio_parts)');
  });

  it('does not silently truncate every message to the former 160-character limit', () => {
    expect(source).not.toContain('if len(text) > 160:');
    expect(source).toContain('MAX_TTS_INPUT_CHARS');
    expect(source).toContain('truncated = len(text) > MAX_TTS_INPUT_CHARS');
  });

  it('keeps Mai Chi selected and reports segmented output metadata', () => {
    expect(source).toContain('tts.synthesize(segment, voice=voice, eoa_extra_frames=2)');
    expect(source).toContain('"segmentCount": segment_count');
    expect(source).toContain('"truncated": truncated');
  });
});
