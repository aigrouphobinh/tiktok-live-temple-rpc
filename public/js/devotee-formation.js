export const DEFAULT_FORMATION_COLUMNS = 8;
export const DEFAULT_FORMATION_CAPACITY = 40;

/**
 * Returns a stable centered formation slot. The default keeps the historic
 * alternating layout; centered=true creates an evenly spaced left-to-right row.
 */
export function getHorizontalFormationPosition(slot, options = {}) {
  if (!Number.isInteger(slot) || slot < 0) return null;
  const columns = Number.isInteger(options.columns) && options.columns > 0
    ? options.columns
    : DEFAULT_FORMATION_COLUMNS;
  const spacing = Number.isFinite(options.spacing) && options.spacing > 0
    ? options.spacing
    : 1.12;
  const rowSpacing = Number.isFinite(options.rowSpacing) && options.rowSpacing > 0
    ? options.rowSpacing
    : 1.28;
  const baseZ = Number.isFinite(options.baseZ) ? options.baseZ : -1.55;
  const y = Number.isFinite(options.y) ? options.y : 0.05;
  const column = slot % columns;
  const row = Math.floor(slot / columns);
  const x = options.centered === true
    ? (column - (columns - 1) / 2) * spacing
    : (column % 2 === 0 ? -1 : 1) * (Math.ceil((column + 1) / 2) - 0.5) * spacing;
  return { slot, column, row, x, y, z: baseZ + row * rowSpacing };
}

/** Finds the first free slot without changing any existing occupant's slot. */
export function getAvailableFormationSlot(occupiedSlots, capacity = DEFAULT_FORMATION_CAPACITY) {
  const limit = Number.isInteger(capacity) && capacity >= 0
    ? capacity
    : DEFAULT_FORMATION_CAPACITY;
  const occupied = new Set();
  if (occupiedSlots && typeof occupiedSlots[Symbol.iterator] === 'function') {
    for (const slot of occupiedSlots) {
      if (Number.isInteger(slot) && slot >= 0 && slot < limit) occupied.add(slot);
    }
  }
  for (let slot = 0; slot < limit; slot++) {
    if (!occupied.has(slot)) return slot;
  }
  return -1;
}

/** Layouts crowd name labels in two staggered vertical lanes. */
export function getCrowdNameTagLayout(slot, options = {}) {
  if (!Number.isInteger(slot) || slot < 0) return null;
  const columns = Number.isInteger(options.columns) && options.columns > 0
    ? options.columns
    : DEFAULT_FORMATION_COLUMNS;
  const half = Math.floor(columns / 2);
  const column = slot % columns;
  // A single-file queue uses one centered nameplate lane; the legacy
  // alternating calculation is only valid when at least two columns exist.
  const screenIndex = columns === 1 ? 0 : (column % 2 === 0
    ? half - 1 - column / 2
    : half + (column - 1) / 2);
  const baseY = Number.isFinite(options.baseY) ? options.baseY : 1.82;
  const staggerY = Number.isFinite(options.staggerY) && options.staggerY > 0 ? options.staggerY : 0.36;
  const width = Number.isFinite(options.width) && options.width > 0 ? options.width : 1.94;
  const height = Number.isFinite(options.height) && options.height > 0 ? options.height : 0.30;
  return { screenIndex, lane: screenIndex % 2, y: baseY + (screenIndex % 2) * staggerY, width, height };
}

export const MAX_CONCURRENT_WORSHIPPERS = 5;
export const MAX_QUEUED_WORSHIPPERS = MAX_CONCURRENT_WORSHIPPERS - 1;
export const MAX_VISIBLE_QUEUE_ACTORS = DEFAULT_FORMATION_CAPACITY;

const QUEUED_WORSHIP_POSITIONS = Object.freeze([
  Object.freeze({ x: -3.15, y: 0.05, z: -1.35 }),
  Object.freeze({ x: -1.05, y: 0.05, z: -1.65 }),
  Object.freeze({ x: 1.05, y: 0.05, z: -1.65 }),
  Object.freeze({ x: 3.15, y: 0.05, z: -1.35 })
]);

// Four columns flank the processional carpet: two on the left, two on the
// right. Each row moves toward the altar while keeping the central aisle clear.
const WAITING_SEAT_X = Object.freeze([-5.8, -3.9, 3.9, 5.8]);
const WAITING_SEAT_BASE_Z = 11.8;
const WAITING_SEAT_ROW_SPACING = 1.35;

/**
 * The active visitor and first four queued visitors share five prayer places.
 * Everyone else sits on a round lotus cushion in a four-column congregation grid.
 */
export function getQueueActorFormationPosition(slot) {
  if (!Number.isInteger(slot) || slot < 0 || slot >= MAX_VISIBLE_QUEUE_ACTORS) return null;
  if (slot < MAX_QUEUED_WORSHIPPERS) {
    return { slot, role: 'worship', ...QUEUED_WORSHIP_POSITIONS[slot] };
  }
  const waitingSlot = slot - MAX_QUEUED_WORSHIPPERS;
  const column = waitingSlot % WAITING_SEAT_X.length;
  const row = Math.floor(waitingSlot / WAITING_SEAT_X.length);
  return {
    slot,
    role: 'waiting',
    column,
    row,
    x: WAITING_SEAT_X[column],
    y: 0.05,
    z: WAITING_SEAT_BASE_Z - row * WAITING_SEAT_ROW_SPACING
  };
}
