/**
 * Deterministic single-character state machine.
 * Visual orchestration only: it never changes server merit/reward data.
 */
export const GIFT_PRIORITY = Object.freeze({ rocket: 100, dragon: 80, donut: 60, rose: 30 });

export class CharacterStateMachine {
  constructor({ maxQueue = 40 } = {}) {
    this.maxQueue = maxQueue;
    this.state = 'IDLE';
    this.active = null;
    this.queue = [];
    this.effect = null;
    this.effectQueue = [];
  }

  transition(nextState) {
    const allowed = {
      APPROACHING: ['OFFERING', 'INTERRUPTED'],
      OFFERING: ['BOWING', 'INTERRUPTED'],
      BOWING: ['RETURNING', 'INTERRUPTED'],
      RETURNING: ['IDLE'],
      INTERRUPTED: ['COOLDOWN'],
      COOLDOWN: ['IDLE']
    };
    if (!allowed[this.state]?.includes(nextState)) return false;
    this.state = nextState;
    return true;
  }

  request(event) {
    if (!event || typeof event !== 'object') return { accepted: false };
    if (!this.active && !this.effect && this.state === 'IDLE') {
      this.active = event;
      this.state = 'APPROACHING';
      return { accepted: true, started: true, event };
    }
    if (this.queue.length >= this.maxQueue) return { accepted: false, reason: 'queue_full' };
    this.queue.push(event);
    return { accepted: true, queued: true, position: this.queue.length };
  }

  interrupt(action, giftEvent) {
    const priority = GIFT_PRIORITY[action] || 0;
    if (!priority) return { interrupted: false, reason: 'unknown_action' };

    if (this.effect) {
      if (priority > this.effect.priority) {
        const previous = this.effect;
        this.effect = { action, priority, event: giftEvent };
        this.state = 'INTERRUPTED';
        return { interrupted: true, superseded: true, previous: previous.action, action };
      }
      if (this.effectQueue.length >= this.maxQueue) {
        return { interrupted: false, reason: 'effect_queue_full' };
      }
      this.effectQueue.push({ action, priority, event: giftEvent });
      this.effectQueue.sort((a, b) => b.priority - a.priority);
      return { interrupted: false, queuedEffect: true, position: this.effectQueue.length };
    }

    if (!this.active) return { interrupted: false, reason: 'no_active_character' };

    if (this.queue.length >= this.maxQueue) this.queue.pop();
    this.queue.unshift(this.active);
    this.active = null;
    this.effect = { action, priority, event: giftEvent };
    this.state = 'INTERRUPTED';
    return { interrupted: true, action };
  }

  finishEffect() {
    if (this.effectQueue.length) {
      this.effect = this.effectQueue.shift();
      this.state = 'INTERRUPTED';
      return { nextEffect: this.effect };
    }
    this.effect = null;
    this.state = 'COOLDOWN';
    return { cooldown: true };
  }

  finishCooldown() {
    this.state = 'IDLE';
    return this.startNext();
  }

  completeActive() {
    this.active = null;
    this.state = 'IDLE';
    return this.startNext();
  }

  startNext() {
    if (this.state !== 'IDLE' || this.active || this.effect || !this.queue.length) {
      return { started: false };
    }
    this.active = this.queue.shift();
    this.state = 'APPROACHING';
    return { started: true, event: this.active };
  }

  snapshot() {
    return {
      state: this.state,
      active: this.active,
      queueLength: this.queue.length,
      effect: this.effect?.action || null,
      queuedEffects: this.effectQueue.map((item) => item.action)
    };
  }
}
