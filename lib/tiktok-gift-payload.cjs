'use strict';

const MAX_GIFT_REPEAT_COUNT = 100000;
const FINALIZED_STREAK_TTL_MS = 5000;
const finalizedStreaks = new WeakMap();

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function normalizeGiftPayload(data = {}, uniqueId = '') {
  const gift = { ...(data.giftDetails || {}), ...(data.gift || {}) };
  const extended = data.extendedGiftInfo || {};
  const rawGiftId = firstDefined(data.giftId, data.gift_id, gift.id, gift.giftId, gift.gift_id);
  const rawGiftName = firstDefined(
    data.giftName,
    gift.giftName,
    gift.name,
    extended.name,
    extended.giftName,
    gift.describe,
    data.describe
  );
  const rawDiamonds = firstDefined(
    gift.diamondCount,
    gift.diamond_count,
    data.diamondCount,
    extended.diamondCount,
    extended.diamond_count
  );
  const parsedDiamonds = Number(rawDiamonds);
  const parsedRepeat = Number(firstDefined(
    data.repeatCount,
    data.comboCount,
    data.repeat_count,
    data.combo_count,
    gift.repeatCount,
    gift.repeat_count,
    1
  ));
  const giftType = Number(firstDefined(
    gift.giftType,
    gift.type,
    data.giftType,
    gift.gift_type,
    data.gift_type,
    0
  ));

  const giftId = rawGiftId == null ? '' : String(rawGiftId).slice(0, 80);
  const giftName = rawGiftName == null ? '' : String(rawGiftName).slice(0, 120);
  const diamondCount = Number.isFinite(parsedDiamonds) && parsedDiamonds >= 1 ? parsedDiamonds : 1;
  const repeatCount = Number.isFinite(parsedRepeat)
    ? Math.min(MAX_GIFT_REPEAT_COUNT, Math.max(1, Math.floor(parsedRepeat)))
    : 1;
  const rawRepeatEnd = firstDefined(data.repeatEnd, data.repeat_end, gift.repeatEnd, gift.repeat_end);
  const repeatEnd = rawRepeatEnd === true || rawRepeatEnd === 1 ||
    rawRepeatEnd === '1' || rawRepeatEnd === 'true';
  const groupId = String(firstDefined(
    data.groupId,
    data.group_id,
    gift.groupId,
    gift.group_id,
    `${uniqueId}|${giftId || giftName || `unknown:${diamondCount}`}`
  )).slice(0, 180);

  return {
    giftId,
    giftName,
    diamondCount,
    repeatCount,
    repeatEnd,
    giftType,
    streakable: giftType === 1,
    groupId
  };
}

/**
 * Convert cumulative TikTok streak updates into incremental gift counts.
 * Non-streakable gifts are independent events and never share tracker state.
 * A final repeatEnd frame clears the streak, and a subsequent combo starts with a clean counter.
 */
function getGiftComboDelta(tracker, payload, maxEntries = 500, now = Date.now()) {
  const groupId = String(payload?.groupId || '');
  const repeatCount = Math.min(MAX_GIFT_REPEAT_COUNT, Math.max(1, Math.floor(Number(payload?.repeatCount) || 1)));
  const repeatEnd = Boolean(payload?.repeatEnd);
  if (!payload?.streakable || !groupId) return repeatCount;

  const timestamp = Number.isFinite(now) ? now : Date.now();
  const limit = Number.isInteger(maxEntries) && maxEntries > 0 ? maxEntries : 500;
  let finalized = finalizedStreaks.get(tracker);
  if (!finalized) {
    finalized = new Map();
    finalizedStreaks.set(tracker, finalized);
  }

  // TikTok may send the same final repeatEnd packet more than once. A short
  // tombstone prevents the deleted running counter from crediting the full
  // cumulative count again. A lower count is treated as a fresh reused ID.
  for (const [key, marker] of finalized) {
    if (timestamp - marker.finalizedAt > FINALIZED_STREAK_TTL_MS) finalized.delete(key);
  }
  const finalMarker = finalized.get(groupId);
  if (finalMarker && timestamp - finalMarker.finalizedAt <= FINALIZED_STREAK_TTL_MS) {
    if (repeatCount >= finalMarker.count) return 0;
    finalized.delete(groupId);
  }

  const previousCount = tracker.get(groupId) || 0;
  const deltaCount = Math.max(0, repeatCount - previousCount);
  if (repeatEnd) {
    tracker.delete(groupId);
    finalized.set(groupId, { count: repeatCount, finalizedAt: timestamp });
    while (finalized.size > limit) {
      const oldestKey = finalized.keys().next().value;
      if (oldestKey === undefined) break;
      finalized.delete(oldestKey);
    }
  } else if (deltaCount > 0) {
    tracker.set(groupId, repeatCount);
    while (tracker.size > limit) {
      const oldestKey = tracker.keys().next().value;
      if (oldestKey === undefined) break;
      tracker.delete(oldestKey);
    }
  }
  return deltaCount;
}

function clearGiftComboTracker(tracker) {
  tracker?.clear?.();
  finalizedStreaks.get(tracker)?.clear();
}

module.exports = {
  MAX_GIFT_REPEAT_COUNT,
  normalizeGiftPayload,
  getGiftComboDelta,
  clearGiftComboTracker
};
