import { describe, expect, it } from 'bun:test';
import {
  DEFAULT_FORMATION_CAPACITY,
  DEFAULT_FORMATION_COLUMNS,
  getAvailableFormationSlot,
  getHorizontalFormationPosition
} from '../public/js/devotee-formation.js';

describe('stable horizontal devotee formation', () => {
  it('places eight devotees symmetrically across the altar row', () => {
    const positions = Array.from({ length: DEFAULT_FORMATION_COLUMNS }, (_, slot) =>
      getHorizontalFormationPosition(slot)
    );
    expect(positions.map((position) => position.x)).toEqual([
      -0.56, 0.56, -1.68, 1.68, -2.8, 2.8, -3.92, 3.92
    ]);
    expect(positions.every((position) => position.row === 0 && position.z === -1.55)).toBe(true);
  });

  it('starts a new row after the configured column count', () => {
    const first = getHorizontalFormationPosition(0, { baseZ: 15.3, rowSpacing: 1.28 });
    const ninth = getHorizontalFormationPosition(8, { baseZ: 15.3, rowSpacing: 1.28 });
    expect(first).toMatchObject({ column: 0, row: 0, x: -0.56, y: 0.05, z: 15.3 });
    expect(ninth).toMatchObject({ column: 0, row: 1, x: -0.56, y: 0.05, z: 16.580000000000002 });
  });

  it('reuses only an unoccupied slot and never renumbers existing slots', () => {
    const occupied = new Set([0, 1, 3, 4, 7]);
    expect(getAvailableFormationSlot(occupied)).toBe(2);
    expect([...occupied]).toEqual([0, 1, 3, 4, 7]);
  });

  it('returns no slot when the formation is full', () => {
    expect(getAvailableFormationSlot(Array.from({ length: DEFAULT_FORMATION_CAPACITY }, (_, i) => i))).toBe(-1);
    expect(getHorizontalFormationPosition(-1)).toBeNull();
  });
});
