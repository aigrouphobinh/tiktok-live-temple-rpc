import { describe, expect, it } from 'bun:test';
import {
  DEFAULT_FORMATION_CAPACITY,
  DEFAULT_FORMATION_COLUMNS,
  getAvailableFormationSlot,
  getHorizontalFormationPosition,
  getCrowdNameTagLayout,
  getQueueActorFormationPosition,
  getQueueActorEntryPosition,
  createQueueWorshipLedger,
  MAX_CONCURRENT_WORSHIPPERS,
  MAX_QUEUED_WORSHIPPERS,
  MAX_VISIBLE_QUEUE_ACTORS,
  WAITING_SEAT_COLUMNS,
  WAITING_SEAT_ROWS,
  WAITING_SEAT_COUNT,
  WAITING_SEAT_FRONT_Z,
  WAITING_SEAT_ROW_SPACING,
  getQueueActorFormationSlots
} from '../public/js/devotee-formation.js';

describe('stable horizontal devotee formation', () => {
  it('places eight devotees symmetrically across the altar row', () => {
    const positions = Array.from({ length: DEFAULT_FORMATION_COLUMNS }, (_, slot) =>
      getHorizontalFormationPosition(slot)
    );
    expect(positions.map((position) => Number(position.x.toFixed(2)))).toEqual([
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

  it('staggered username tags never collide across the eight-person row', () => {
    const tags = Array.from({ length: DEFAULT_FORMATION_COLUMNS }, (_, slot) => ({
      slot,
      position: getHorizontalFormationPosition(slot),
      layout: getCrowdNameTagLayout(slot)
    }));
    for (let left = 0; left < tags.length; left++) {
      for (let right = left + 1; right < tags.length; right++) {
        const a = tags[left];
        const b = tags[right];
        const horizontalOverlap = Math.abs(a.position.x - b.position.x)
          < (a.layout.width + b.layout.width) / 2;
        const verticalOverlap = Math.abs(a.layout.y - b.layout.y)
          < (a.layout.height + b.layout.height) / 2;
        expect(horizontalOverlap && verticalOverlap).toBe(false);
      }
    }
  });


  it('keeps 40 permanent places and fills the 6x6 waiting grid from altar-center outward', () => {
    const visibleQueue = Array.from({ length: 5 }, (_, slot) =>
      getQueueActorFormationPosition(slot)
    );
    expect(MAX_CONCURRENT_WORSHIPPERS).toBe(5);
    expect(MAX_QUEUED_WORSHIPPERS).toBe(4);
    expect(MAX_VISIBLE_QUEUE_ACTORS).toBe(40);
    expect(WAITING_SEAT_COLUMNS).toBe(6);
    expect(WAITING_SEAT_ROWS).toBe(6);
    expect(WAITING_SEAT_COUNT).toBe(36);

    // Four nearest ritual positions remain grouped in front of the altar.
    expect(visibleQueue.slice(0, 4).map((position) => position.role)).toEqual([
      'worship', 'worship', 'worship', 'worship'
    ]);
    expect(visibleQueue.map(({ x }) => x)).toEqual([-1.05, 1.05, -3.15, 3.15, -0.84]);

    const firstWaitingRow = Array.from({ length: WAITING_SEAT_COLUMNS }, (_, column) =>
      getQueueActorFormationPosition(column + MAX_QUEUED_WORSHIPPERS)
    );
    // First fill the two inner places, then progress outward on both sides.
    expect(firstWaitingRow.map(({ x }) => x)).toEqual([
      -0.84, 0.84, -2.52, 2.52, -4.2, 4.2
    ]);
    expect(firstWaitingRow.every(({ row, z }) => row === 0 && z === WAITING_SEAT_FRONT_Z)).toBe(true);

    const firstSeatInSecondRow = getQueueActorFormationPosition(10);
    expect(firstSeatInSecondRow).toMatchObject({
      slot: 10,
      role: 'waiting',
      column: 0,
      row: 1,
      x: -0.84,
      y: 0.05
    });
    expect(firstSeatInSecondRow.z).toBeCloseTo(
      WAITING_SEAT_FRONT_Z + WAITING_SEAT_ROW_SPACING,
      6
    );

    const lastSeat = getQueueActorFormationPosition(39);
    expect(lastSeat).toMatchObject({
      slot: 39,
      role: 'waiting',
      column: 5,
      row: 5,
      x: 4.2
    });
    expect(lastSeat.z).toBeCloseTo(
      WAITING_SEAT_FRONT_Z + (WAITING_SEAT_ROWS - 1) * WAITING_SEAT_ROW_SPACING,
      6
    );

    const congregationSeats = Array.from({ length: WAITING_SEAT_COUNT }, (_, index) =>
      getQueueActorFormationPosition(index + MAX_QUEUED_WORSHIPPERS)
    );
    expect(new Set(congregationSeats.map(({ x, z }) => `${x}:${z}`)).size).toBe(WAITING_SEAT_COUNT);
    // There is no broad central aisle through the seated congregation.
    const physicalColumns = [...new Set(congregationSeats.map(({ x }) => x))].sort((a, b) => a - b);
    expect(physicalColumns).toEqual([-4.2, -2.52, -0.84, 0.84, 2.52, 4.2]);
    expect(Math.max(...physicalColumns.slice(1).map((x, index) => x - physicalColumns[index])))
      .toBeCloseTo(1.68, 6);

    const allPermanentPlaces = getQueueActorFormationSlots();
    expect(allPermanentPlaces).toHaveLength(40);
    expect(allPermanentPlaces.filter(({ role }) => role === 'worship')).toHaveLength(4);
    expect(allPermanentPlaces.filter(({ role }) => role === 'waiting')).toHaveLength(36);
    expect(getQueueActorFormationPosition(40)).toBeNull();
    expect(getQueueActorFormationPosition(-1)).toBeNull();
  });

  it('starts four worshippers on one line for synchronized arrival and parallel bows', () => {
    const entries = Array.from({ length: 4 }, (_, slot) => getQueueActorEntryPosition(slot));
    expect(entries.map(({ x }) => x)).toEqual([-1.05, 1.05, -3.15, 3.15]);
    expect(entries.every(({ z }) => z === 12.2)).toBe(true);
    const paths = entries.map((entry, slot) => {
      const target = getQueueActorFormationPosition(slot);
      return Math.hypot(target.x - entry.x, target.z - entry.z);
    });
    expect(Math.max(...paths) - Math.min(...paths)).toBeLessThan(0.35);
    const waitingEntry = getQueueActorEntryPosition(4);
    expect(waitingEntry).toMatchObject({
      slot: 4,
      role: 'waiting',
      x: -0.84,
      y: 0.05
    });
    expect(waitingEntry.z).toBeCloseTo(WAITING_SEAT_FRONT_Z + 1.05, 6);
  });

  it('locks completed side-lane worship until the original FIFO visit completes', () => {
    const ledger = createQueueWorshipLedger();
    expect(ledger.size).toBe(0);
    expect(ledger.mark('viewer:alice')).toBe(true);
    // A replacement event object for the same viewer remains blocked.
    expect(ledger.has('viewer:alice')).toBe(true);
    expect(ledger.mark('viewer:alice')).toBe(true);
    expect(ledger.size).toBe(1);
    // Only the FIFO completion event releases the next genuine visit.
    expect(ledger.complete('viewer:alice')).toBe(true);
    expect(ledger.has('viewer:alice')).toBe(false);
    expect(ledger.complete('viewer:alice')).toBe(false);
    expect(ledger.mark('')).toBe(false);
  });

  it('returns no slot when the formation is full', () => {
    expect(getAvailableFormationSlot(Array.from({ length: DEFAULT_FORMATION_CAPACITY }, (_, i) => i))).toBe(-1);
    expect(getHorizontalFormationPosition(-1)).toBeNull();
  });
});
