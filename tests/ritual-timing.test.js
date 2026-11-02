import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';

const scene = readFileSync(new URL('../public/js/temple-3d.js', import.meta.url), 'utf8');
const engine = readFileSync(new URL('../public/js/gift-action-engine.js', import.meta.url), 'utf8');

describe('Ritual visit timing', () => {
  it('allows a natural entrance, approach and three bows before releasing the altar', () => {
    expect(scene).toContain("setDevoteePhase('enter', now, 1700);");
    expect(scene).toContain("setDevoteePhase('queue', now, 200);");
    expect(scene).toContain("setDevoteePhase('approach', now, 3000);");
    expect(scene).toContain('devoteeState.phaseDuration = duration;');
    expect(scene).toContain('bowCycles: 3,');
    expect(scene).toContain('bowCycleMs: 1500,');
    expect(scene).toContain('bowDownRatio: 0.34,');
    expect(scene).toContain('bowHoldRatio: 0.20,');
    expect(scene).toContain('bowUpRatio: 0.34,');
    expect(engine).toContain('const ritualDurationMs = window.__TEMPLE_3D_READY__ === true ? 15000 : 12500;');
    expect(engine).toContain('const ritualDurationMs = window.__TEMPLE_3D_READY__ === true ? 15000 : 12500;');
    expect(engine).toContain("event?.type === 'drawFortune' ? 18000 : ritualDurationMs");
  });

  it('keeps the first visitor on the side entrance and subsequent visitors in horizontal altar rows', () => {
    expect(scene).toContain('mainDevotee.position.copy(queueStart || new THREE.Vector3(-4.55, 0.05, 15.3));');
    expect(scene).toContain("enter: [[-4.55, 0, 15.3], [-4.2, 0, 13.8], [-3.85, 0, 10.8], [-3.65, 0, 8.0]]");
    expect(scene).toContain('getQueueActorFormationPosition, getQueueActorEntryPosition, createQueueWorshipLedger, MAX_CONCURRENT_WORSHIPPERS, MAX_QUEUED_WORSHIPPERS, MAX_VISIBLE_QUEUE_ACTORS');
    expect(scene).toContain('const queueFormation = getQueueActorFormationPosition(slot);');
    expect(scene).toContain('const entryPosition = getQueueActorEntryPosition(index);');
    expect(scene).toContain('actor.avatar.queuedWorshipLane = isWorshipLane;');
    expect(scene).toContain('actor.seat.visible = !isWorshipLane;');
    expect(scene).toContain('actor.slot = slot;');
  });
});
