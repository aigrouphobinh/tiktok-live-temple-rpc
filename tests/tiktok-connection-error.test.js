import { describe, expect, it } from 'bun:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { formatTikTokConnectionError } = require('../lib/tiktok-connection-error.cjs');

describe('TikTok connection error formatting', () => {
  it('formats a normal Error without object coercion', () => {
    expect(formatTikTokConnectionError(new Error('socket closed'))).toBe('socket closed');
  });

  it('extracts a nested message from plain connector error objects', () => {
    expect(formatTikTokConnectionError({
      message: { message: 'Error connecting to WebSocket: illegal secret key' }
    })).toBe('Error connecting to WebSocket: illegal secret key');
  });

  it('preserves TikTok handshake-msg and status headers', () => {
    expect(formatTikTokConnectionError({
      message: 'WebSocket handshake rejected',
      response: {
        status: 200,
        headers: {
          'handshake-msg': 'illegal secret key',
          'handshake-status': '417'
        }
      }
    })).toBe('WebSocket handshake rejected | handshake-msg: illegal secret key | handshake-status: 417 | http-status: 200');
  });

  it('never returns the literal object coercion string', () => {
    expect(formatTikTokConnectionError({ message: { code: 'WS_REJECTED' } })).not.toBe('[object Object]');
  });
});
