export const DEFAULT_FORMATION_COLUMNS = 8;
export const DEFAULT_FORMATION_CAPACITY = 40;

/**
 * Returns a centered, alternating left/right position for a stable crowd slot.
 * Slots fill outward from the center, then continue into rows behind the altar.
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
  const side = Math.ceil((column + 1) / 2);
  const x = (column % 2 === 0 ? -1 : 1) * (side - 0.5) * spacing;
  return { slot, column, row, x, y, z: baseZ + row * rowSpacing };
}

/**
 * Finds the first free slot without changing any existing occupant's slot.
 * Returns -1 when the visible formation has reached capacity.
 */
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
