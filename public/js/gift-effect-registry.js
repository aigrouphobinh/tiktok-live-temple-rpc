export class GiftEffectRegistry {
  #entries = new Map();
  track(element, animation) {
    if (!element || !animation || typeof animation.cancel !== 'function') return false;
    this.#entries.set(animation, element);
    Promise.resolve(animation.finished).catch(() => {}).finally(() => {
      if (this.#entries.get(animation) !== element) return;
      this.#entries.delete(animation);
      element.remove?.();
    });
    return true;
  }
  clear() {
    const entries = [...this.#entries.entries()];
    this.#entries.clear();
    for (const [animation, element] of entries) {
      try { animation.cancel(); } catch {}
      element.remove?.();
    }
    return entries.length;
  }
  get size() { return this.#entries.size; }
}
