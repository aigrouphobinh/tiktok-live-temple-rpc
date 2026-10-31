import { describe, expect, it } from 'bun:test';
import { CharacterStateMachine } from '../public/js/character-state-machine.js';

const devotee = (user) => ({ type: 'burnIncense', user });

describe('CharacterStateMachine', () => {
  it('grants one character exclusive ownership and queues later devotees FIFO', () => {
    const machine = new CharacterStateMachine();
    expect(machine.request(devotee('A')).started).toBe(true);
    expect(machine.request(devotee('B')).queued).toBe(true);
    expect(machine.request(devotee('C')).queued).toBe(true);
    expect(machine.snapshot().active.user).toBe('A');
    expect(machine.completeActive().event.user).toBe('B');
    expect(machine.completeActive().event.user).toBe('C');
    expect(machine.completeActive().started).toBe(false);
    expect(machine.snapshot().state).toBe('IDLE');
  });

  it('tracks the approach, offering and bow phases in order', () => {
    const machine = new CharacterStateMachine();
    machine.request(devotee('A'));
    expect(machine.snapshot().state).toBe('APPROACHING');
    expect(machine.transition('OFFERING')).toBe(true);
    expect(machine.transition('BOWING')).toBe(true);
    expect(machine.transition('OFFERING')).toBe(false);
    expect(machine.snapshot().state).toBe('BOWING');
  });

  it('interrupts the active devotee and puts that same devotee at the front of the queue', () => {
    const machine = new CharacterStateMachine();
    machine.request(devotee('A'));
    machine.request(devotee('B'));
    const result = machine.interrupt('rocket', { giftName: 'Rocket' });
    expect(result.interrupted).toBe(true);
    expect(machine.snapshot()).toMatchObject({
      state: 'INTERRUPTED',
      active: null,
      queueLength: 2,
      effect: 'rocket'
    });
    machine.finishEffect();
    expect(machine.finishCooldown().event.user).toBe('A');
  });

  it('prioritizes Rocket over Donut while an effect is already playing', () => {
    const machine = new CharacterStateMachine();
    machine.request(devotee('A'));
    machine.interrupt('donut', { giftName: 'Donut' });
    const result = machine.interrupt('rocket', { giftName: 'Rocket' });
    expect(result).toMatchObject({ interrupted: true, superseded: true, previous: 'donut' });
    expect(machine.snapshot().effect).toBe('rocket');
  });

  it('keeps Dragon above Donut and Rocket above Dragon', () => {
    const machine = new CharacterStateMachine();
    machine.request(devotee('A'));
    machine.interrupt('donut', { giftName: 'Donut' });
    expect(machine.interrupt('dragon', { giftName: 'Dragon' }).superseded).toBe(true);
    expect(machine.snapshot().effect).toBe('dragon');
    expect(machine.interrupt('rocket', { giftName: 'Rocket' }).superseded).toBe(true);
    expect(machine.snapshot().effect).toBe('rocket');
  });

  it('queues lower-priority effects behind the current higher-priority effect', () => {
    const machine = new CharacterStateMachine();
    machine.request(devotee('A'));
    machine.interrupt('rocket', { giftName: 'Rocket' });
    const result = machine.interrupt('donut', { giftName: 'Donut' });
    expect(result.queuedEffect).toBe(true);
    expect(machine.finishEffect().nextEffect.action).toBe('donut');
    expect(machine.finishEffect().cooldown).toBe(true);
    expect(machine.finishCooldown().event.user).toBe('A');
  });

  it('rejects new devotees when the bounded queue is full', () => {
    const machine = new CharacterStateMachine({ maxQueue: 1 });
    machine.request(devotee('A'));
    expect(machine.request(devotee('B')).queued).toBe(true);
    expect(machine.request(devotee('C'))).toMatchObject({ accepted: false, reason: 'queue_full' });
    expect(machine.snapshot().queueLength).toBe(1);
  });
});


describe('gift priority tiers', () => {
  it('keeps Rose below Donut, Dragon and Rocket', () => {
    const machine = new CharacterStateMachine();
    machine.request({ type: 'burnIncense', user: 'A' });
    expect(machine.interrupt('rose', { giftName: 'Rose' }).interrupted).toBe(true);
    expect(machine.interrupt('donut', { giftName: 'Donut' }).superseded).toBe(true);
    expect(machine.interrupt('rose', { giftName: 'Rose' }).queuedEffect).toBe(true);
    expect(machine.interrupt('dragon', { giftName: 'Dragon' }).superseded).toBe(true);
    expect(machine.interrupt('rocket', { giftName: 'Rocket' }).superseded).toBe(true);
    expect(machine.snapshot().effect).toBe('rocket');
    expect(machine.snapshot().queuedEffects).toContain('rose');
  });
});
