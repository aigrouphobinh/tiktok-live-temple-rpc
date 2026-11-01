import { describe, expect, it } from 'bun:test';
import { GiftEffectRegistry } from '../public/js/gift-effect-registry.js';

function fakeAnimation() {
  let rejectPromise;
  let resolvePromise;
  let cancelCount = 0;
  const finished = new Promise((resolve, reject) => { resolvePromise = resolve; rejectPromise = reject; });
  return { finished, cancel() { cancelCount++; rejectPromise(new Error('cancelled')); }, finish() { resolvePromise(); }, get cancelCount() { return cancelCount; } };
}
function fakeElement() { return { removeCount: 0, remove() { this.removeCount++; } }; }

describe('GiftEffectRegistry', () => {
  it('removes elements after natural animation completion', async () => {
    const registry = new GiftEffectRegistry();
    const el = fakeElement();
    const animation = fakeAnimation();
    registry.track(el, animation);
    expect(registry.size).toBe(1);
    animation.finish();
    await Promise.resolve();
    await Promise.resolve();
    expect(registry.size).toBe(0);
    expect(el.removeCount).toBe(1);
  });
  it('cancels animations and removes all elements when clearing', async () => {
    const registry = new GiftEffectRegistry();
    const a = fakeElement();
    const b = fakeElement();
    const first = fakeAnimation();
    const second = fakeAnimation();
    registry.track(a, first);
    registry.track(b, second);
    expect(registry.clear()).toBe(2);
    expect(first.cancelCount).toBe(1);
    expect(second.cancelCount).toBe(1);
    expect(a.removeCount).toBe(1);
    expect(b.removeCount).toBe(1);
    expect(registry.size).toBe(0);
    await Promise.resolve();
    await Promise.resolve();
    expect(a.removeCount).toBe(1);
    expect(b.removeCount).toBe(1);
  });
  it('rejects invalid registrations', () => {
    const registry = new GiftEffectRegistry();
    expect(registry.track(null, fakeAnimation())).toBe(false);
    expect(registry.track(fakeElement(), null)).toBe(false);
    expect(registry.size).toBe(0);
  });
  it('allows repeated clearing of an empty registry', () => {
    const registry = new GiftEffectRegistry();
    expect(registry.clear()).toBe(0);
    expect(registry.clear()).toBe(0);
  });
});
