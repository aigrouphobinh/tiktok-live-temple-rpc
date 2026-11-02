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
  const screenIndex = column % 2 === 0
    ? half - 1 - column / 2
    : half + (column - 1) / 2;
  const baseY = Number.isFinite(options.baseY) ? options.baseY : 1.82;
  const staggerY = Number.isFinite(options.staggerY) && options.staggerY > 0 ? options.staggerY : 0.36;
  const width = Number.isFinite(options.width) && options.width > 0 ? options.width : 1.94;
  const height = Number.isFinite(options.height) && options.height > 0 ? options.height : 0.30;
  return { screenIndex, lane: screenIndex % 2, y: baseY + (screenIndex % 2) * staggerY, width, height };
}
