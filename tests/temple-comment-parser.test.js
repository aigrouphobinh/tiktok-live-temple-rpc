import { describe, expect, it } from 'bun:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { classifyTempleComment } = require('../lib/temple-comment-parser.cjs');

describe('TikTok comment intent classification', () => {
  it.each(['xin xăm', 'gieo quẻ', 'rút quẻ', 'xin que', 'gieo que', 'quẻ', 'que'])(
    'recognizes fortune command: %s',
    (comment) => expect(classifyTempleComment(comment)).toBe('fortune')
  );

  it.each(['quen rồi', 'đừng quên', 'quê hương', 'que huong', 'quen biết nhau'])(
    'does not misread ordinary text as a fortune request: %s',
    (comment) => expect(classifyTempleComment(comment)).toBe('default')
  );

  it('preserves ritual priority for bell, wooden fish, incense and prayer', () => {
    expect(classifyTempleComment('thỉnh chuông cầu an')).toBe('bell');
    expect(classifyTempleComment('gõ mõ tụng kinh')).toBe('woodenFish');
    expect(classifyTempleComment('dâng hương')).toBe('incense');
    expect(classifyTempleComment('cầu gia đình bình an')).toBe('prayer');
  });
});
