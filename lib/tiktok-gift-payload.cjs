'use strict';

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function normalizeGiftPayload(data = {}, uniqueId = '') {
  const gift = data.gift || data.giftDetails || {};
  const extended = data.extendedGiftInfo || {};
  const rawGiftId = firstDefined(data.giftId, gift.id, gift.giftId);
  const rawGiftName = firstDefined(
    data.giftName,
    gift.giftName,
    gift.name,
    extended.name,
    extended.giftName,
    gift.describe
  );
  const rawDiamonds = firstDefined(gift.diamondCount, data.diamondCount, extended.diamondCount);
  const parsedDiamonds = Number(rawDiamonds);
  const parsedRepeat = Number(firstDefined(data.repeatCount, data.comboCount, 1));
  const giftType = Number(firstDefined(gift.giftType, gift.type, data.giftType, 0));

  const giftId = rawGiftId == null ? '' : String(rawGiftId).slice(0, 80);
  const giftName = rawGiftName == null ? '' : String(rawGiftName).slice(0, 120);
  const diamondCount = Number.isFinite(parsedDiamonds) && parsedDiamonds >= 0 ? parsedDiamonds : 1;
  const repeatCount = Number.isFinite(parsedRepeat) ? Math.max(1, Math.floor(parsedRepeat)) : 1;
  const repeatEnd = data.repeatEnd === true || data.repeatEnd === 1 || data.repeatEnd === '1';
  const groupId = String(firstDefined(
    data.groupId,
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
 * A final repeatEnd frame clears the streak, including duplicate final frames.
 */
function getGiftComboDelta(tracker, payload, maxEntries = 500) {
  const { groupId, repeatCount, repeatEnd, streakable } = payload;
  if (!streakable) return repeatCount;

  const previousCount = tracker.get(groupId) || 0;
  if (repeatEnd && repeatCount <= previousCount) {
    tracker.delete(groupId);
    return 0;
  }

  const deltaCount = Math.max(1, repeatCount - previousCount);
  if (repeatEnd) {
    tracker.delete(groupId);
  } else {
    tracker.set(groupId, repeatCount);
    while (tracker.size > maxEntries) {
      const oldestKey = tracker.keys().next().value;
      if (oldestKey === undefined) break;
      tracker.delete(oldestKey);
    }
  }
  return deltaCount;
}

module.exports = { normalizeGiftPayload, getGiftComboDelta };
