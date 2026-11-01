import { describe, expect, it } from 'bun:test';
import { findBestAnimationClip } from '../public/js/three-animation-utils.js';

describe('GLB animation clip matching', () => {
  it('prefers explicit action names over generic synonyms and source order', () => {
    const generic = { name: 'Run Cycle' };
    const specific = { name: 'Walk Forward' };
    const actions = findBestAnimationClip([generic, specific]);
    expect(actions.walk).toBe(specific);
  });

  it('matches common exported clip separators and case variations', () => {
    const idle = { name: 'Armature|Mixamo.com|Idle' };
    const bow = { name: 'Prayer-Kneel' };
    const actions = findBestAnimationClip([idle, bow]);
    expect(actions.idle).toBe(idle);
    expect(actions.bow).toBe(bow);
  });

  it('does not match generic aliases inside unrelated words', () => {
    const unrelated = { name: 'Remove Props' };
    const actions = findBestAnimationClip([unrelated]);
    expect(actions.walk).toBeNull();
    expect(actions.idle).toBeNull();
    expect(actions.bow).toBeNull();
  });

  it('returns null for missing action categories without inventing clips', () => {
    const idle = { name: 'Idle' };
    const actions = findBestAnimationClip([idle]);
    expect(actions.idle).toBe(idle);
    expect(actions.walk).toBeNull();
    expect(actions.bow).toBeNull();
  });
});
