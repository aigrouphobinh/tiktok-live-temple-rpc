import { describe, expect, it } from 'bun:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { BoundedSerialQueue } = require('../lib/bounded-serial-queue.cjs');

describe('BoundedSerialQueue', () => {
  it('preserves FIFO order and releases one item at a time', () => {
    const queue = new BoundedSerialQueue({ maxPending: 3 });
    const a = { id: 'a' }, b = { id: 'b' }, c = { id: 'c' };
    expect(queue.enqueue(a)).toBe(true);
    expect(queue.enqueue(b)).toBe(true);
    expect(queue.enqueue(c)).toBe(true);
    expect(queue.size).toBe(3);
    expect(queue.dequeue()).toBe(a);
    expect(queue.dequeue()).toBe(b);
    expect(queue.dequeue()).toBe(c);
    expect(queue.dequeue()).toBeNull();
    expect(queue.size).toBe(0);
  });

  it('rejects overflow instead of growing without bound', () => {
    const queue = new BoundedSerialQueue({ maxPending: 2 });
    expect(queue.enqueue({ id: 1 })).toBe(true);
    expect(queue.enqueue({ id: 2 })).toBe(true);
    expect(queue.enqueue({ id: 3 })).toBe(false);
    expect(queue.size).toBe(2);
  });

  it('clears queued jobs so a failed worker can settle them', () => {
    const queue = new BoundedSerialQueue({ maxPending: 2 });
    const jobs = [{ id: 1 }, { id: 2 }];
    jobs.forEach((job) => queue.enqueue(job));
    expect(queue.clear()).toEqual(jobs);
    expect(queue.size).toBe(0);
  });

  it('clamps invalid or extreme queue limits to a safe capacity', () => {
    expect(new BoundedSerialQueue({ maxPending: 0 }).maxPending).toBe(24);
    expect(new BoundedSerialQueue({ maxPending: -2 }).maxPending).toBe(24);
    expect(new BoundedSerialQueue({ maxPending: 1000 }).maxPending).toBe(100);
  });
});
