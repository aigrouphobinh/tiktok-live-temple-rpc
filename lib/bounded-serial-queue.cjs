'use strict';

class BoundedSerialQueue {
  constructor({ maxPending = 24 } = {}) {
    this.maxPending = Number.isInteger(maxPending) && maxPending > 0
      ? Math.min(100, maxPending)
      : 24;
    this.items = [];
  }

  enqueue(item) {
    if (!item || typeof item !== 'object' || this.items.length >= this.maxPending) return false;
    this.items.push(item);
    return true;
  }

  dequeue() {
    return this.items.shift() || null;
  }

  clear() {
    return this.items.splice(0);
  }

  get size() {
    return this.items.length;
  }
}

module.exports = { BoundedSerialQueue };
