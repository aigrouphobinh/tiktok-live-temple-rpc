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
  MAX_VISIBLE_QUEUE_ACTORS
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


  it('supports five simultaneous worshippers while the next visitor meditates', () => {
    const visibleQueue = Array.from({ length: 5 }, (_, slot) =>
      getQueueActorFormationPosition(slot)
    );
    expect(MAX_CONCURRENT_WORSHIPPERS).toBe(5);
    expect(MAX_QUEUED_WORSHIPPERS).toBe(4);
    expect(visibleQueue.slice(0, 4).map((position) => position.role)).toEqual([
      'worship', 'worship', 'worship', 'worship'
    ]);
    expect(visibleQueue[4]).toMatchObject({
      role: 'waiting',
      column: 0,
      row: 0,
      x: -5.8,
      y: 0.05,
      z: 11.8
    });
    expect(getQueueActorFormationPosition(5)).toMatchObject({
      role: 'waiting',
      column: 1,
      row: 0,
      x: -3.9,
      z: 11.8
    });
    const firstSeatInSecondRow = getQueueActorFormationPosition(8);
    expect(firstSeatInSecondRow).toMatchObject({
      slot: 8,
      role: 'waiting',
      column: 0,
      row: 1,
      x: -5.8,
      y: 0.05
    });
    expect(firstSeatInSecondRow.z).toBeCloseTo(10.45, 6);
    const lastSeat = getQueueActorFormationPosition(39);
    expect(lastSeat).toMatchObject({
      role: 'waiting',
      column: 3,
      row: 8,
      x: 5.8
    });
    expect(lastSeat.z).toBeCloseTo(1, 6);
    const congregationSeats = Array.from({ length: 36 }, (_, index) =>
      getQueueActorFormationPosition(index + MAX_QUEUED_WORSHIPPERS)
    );
    expect(new Set(congregationSeats.map(({ x, z }) => `${x}:${z}`)).size).toBe(36);
    expect(congregationSeats.map(({ column }) => column)).toContain(0);
    expect(congregationSeats.map(({ column }) => column)).toContain(3);
    expect(MAX_VISIBLE_QUEUE_ACTORS).toBe(40);
    expect(getQueueActorFormationPosition(40)).toBeNull();
    expect(getQueueActorFormationPosition(-1)).toBeNull();
  });

  it('starts four worshippers on one line for synchronized arrival and parallel bows', () => {
    const entries = Array.from({ length: 4 }, (_, slot) => getQueueActorEntryPosition(slot));
    expect(entries.map(({ x }) => x)).toEqual([-3.15, -1.05, 1.05, 3.15]);
    expect(entries.every(({ z }) => z === 14.2)).toBe(true);
    const paths = entries.map((entry, slot) => {
      const target = getQueueActorFormationPosition(slot);
      return Math.hypot(target.x - entry.x, target.z - entry.z);
    });
    expect(Math.max(...paths) - Math.min(...paths)).toBeLessThan(0.35);
    const waitingEntry = getQueueActorEntryPosition(4);
    expect(waitingEntry).toMatchObject({
      slot: 4,
      role: 'waiting',
      x: -5.8,
      y: 0.05
    });
    expect(waitingEntry.z).toBeCloseTo(12.85, 6);
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
