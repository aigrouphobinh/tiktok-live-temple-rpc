'use strict';

function readErrorText(value) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Error) return value.message || value.name;
  if (value && typeof value === 'object') {
    const nested = value.message ?? value.error ?? value.reason
      ?? value.handshakeMsg ?? value.handshakeMessage;
    if (nested != null && nested !== value) return readErrorText(nested);
    try { return JSON.stringify(value); } catch (_) { return '[unserializable error details]'; }
  }
  return '';
}

function getHeader(headers, names) {
  if (!headers || typeof headers !== 'object') return '';
  for (const name of names) {
    const value = headers[name];
    if (value != null && value !== '') return readErrorText(value);
  }
  return '';
}

/**
 * TikTok's WebSocket error event may carry a plain object instead of Error.
 * Keep public state and logs human-readable and preserve handshake diagnostics
 * without ever stringifying cookies or signed WebSocket URLs.
 */
function formatTikTokConnectionError(error) {
  const messageValue = error?.message ?? error?.error ?? error?.reason ?? error;
  const message = readErrorText(messageValue);
  const headers = error?.response?.headers || error?.headers || {};
  const handshakeMessage = readErrorText(
    error?.handshakeMsg
      ?? error?.handshakeMessage
      ?? getHeader(headers, ['handshake-msg', 'Handshake-Msg', 'handshake_message'])
  );
  const handshakeStatus = readErrorText(
    error?.handshakeStatus
      ?? getHeader(headers, ['handshake-status', 'Handshake-Status'])
  );
  const code = readErrorText(error?.code);
  const status = readErrorText(error?.statusCode ?? error?.status ?? error?.response?.status);

  const details = [];
  if (handshakeMessage && !message.toLowerCase().includes(handshakeMessage.toLowerCase())) {
    details.push(`handshake-msg: ${handshakeMessage}`);
  }
  if (handshakeStatus) details.push(`handshake-status: ${handshakeStatus}`);
  if (code) details.push(`code: ${code}`);
  if (status) details.push(`http-status: ${status}`);
  return [message || 'TikTok Live connection failed', ...details].join(' | ');
}

module.exports = { formatTikTokConnectionError };
