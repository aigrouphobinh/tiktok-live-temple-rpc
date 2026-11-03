// Each camera view is an independent shot action, not just a static camera preset.
// getTempleCameraShotFrame() executes that action's own camera path every frame.

const clamp01 = (value) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
const smooth = (value) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;
const mix3 = (a, b, t) => [
  mix(a[0], b[0], t),
  mix(a[1], b[1], t),
  mix(a[2], b[2], t)
];

const SHOT_ACTIONS = Object.freeze({
  // The camera physically arcs around the Buddha, keeping the statue as the subject.
  'buddha-orbit': (shot, t) => {
    const p = shot.actionParams;
    const angle = p.startAngle + p.sweep * t;
    return {
      position: [
        p.center[0] + Math.sin(angle) * p.radius,
        p.height + Math.sin(t * Math.PI) * 0.35,
        p.center[2] + Math.cos(angle) * p.radius
      ],
      lookAt: p.center,
      fov: p.fov
    };
  },

  // A camera mounted at the Buddha's eye-line slowly scans left-to-right across the hall.
  'buddha-pov-pan': (shot, t) => {
    const p = shot.actionParams;
    const pan = Math.sin(t * Math.PI * 2) * p.panRange;
    return {
      position: p.camera,
      lookAt: [p.lookAt[0] + pan, p.lookAt[1], p.lookAt[2]],
      fov: p.fov
    };
  },

  // A dedicated portrait push-in; the abbot performs a respectful bow while this shot is active.
  'abbot-bow-portrait': (shot, t) => {
    const p = shot.actionParams;
    return {
      position: mix3(p.startPosition, p.endPosition, smooth(t)),
      lookAt: [p.target[0] + Math.sin(t * Math.PI * 2) * 0.12, p.target[1], p.target[2]],
      fov: mix(p.startFov, p.endFov, smooth(t))
    };
  },

  // Track the live worshipper while they enter, approach, bow or leave.
  'devotee-tracking': (shot, t, context) => {
    const p = shot.actionParams;
    const subject = context.subjectPosition;
    if (subject) {
      return {
        position: [
          subject[0] + p.followOffset[0],
          subject[1] + p.followOffset[1],
          subject[2] + p.followOffset[2]
        ],
        lookAt: [
          subject[0] + p.lookOffset[0],
          subject[1] + p.lookOffset[1],
          subject[2] + p.lookOffset[2]
        ],
        fov: p.fov
      };
    }
    return {
      position: mix3(p.fallbackStart, p.fallbackEnd, smooth(t)),
      lookAt: mix3(p.fallbackLookStart, p.fallbackLookEnd, smooth(t)),
      fov: p.fov
    };
  },

  // A crane move reveals the whole sanctuary by lifting and pulling back.
  'hall-crane-reveal': (shot, t) => {
    const p = shot.actionParams;
    return {
      position: mix3(p.startPosition, p.endPosition, smooth(t)),
      lookAt: mix3(p.startLookAt, p.endLookAt, smooth(t)),
      fov: mix(p.startFov, p.endFov, smooth(t))
    };
  },

  // A low lateral dolly travels along the left aisle and turns toward the altar.
  'left-aisle-dolly': (shot, t) => {
    const p = shot.actionParams;
    return {
      position: mix3(p.startPosition, p.endPosition, smooth(t)),
      lookAt: mix3(p.startLookAt, p.endLookAt, smooth(t)),
      fov: p.fov
    };
  },

  // Mirror action for the opposite aisle; its path and direction are independent.
  'right-aisle-dolly': (shot, t) => {
    const p = shot.actionParams;
    return {
      position: mix3(p.startPosition, p.endPosition, smooth(t)),
      lookAt: mix3(p.startLookAt, p.endLookAt, smooth(t)),
      fov: p.fov
    };
  },

  // A separate elevated orbit slowly sweeps around the entire hall, not the Buddha.
  'hall-overview-orbit': (shot, t) => {
    const p = shot.actionParams;
    const angle = p.startAngle + p.sweep * t;
    return {
      position: [
        p.center[0] + Math.sin(angle) * p.radius,
        p.height + Math.sin(t * Math.PI) * 0.6,
        p.center[2] + Math.cos(angle) * p.radius
      ],
      lookAt: p.center,
      fov: p.fov
    };
  }
});

export const TEMPLE_CAMERA_RITUAL_PRESETS = Object.freeze([
  Object.freeze({
    name: 'buddha-orbit',
    subject: 'Buddha statue',
    action: 'buddha-orbit',
    durationMs: 9000,
    actionParams: Object.freeze({
      center: Object.freeze([0, 5.75, -8.25]),
      radius: 14.2,
      height: 8.0,
      startAngle: -0.42,
      sweep: 0.84,
      fov: 47
    })
  }),
  Object.freeze({
    name: 'buddha-pov-pan',
    subject: 'Main hall from Buddha point of view',
    action: 'buddha-pov-pan',
    durationMs: 8500,
    actionParams: Object.freeze({
      camera: Object.freeze([0, 6.15, -6.45]),
      lookAt: Object.freeze([0, 2.35, 12.2]),
      panRange: 8.4,
      fov: 56
    })
  }),
  Object.freeze({
    name: 'abbot-bow-portrait',
    subject: 'Resident abbot',
    action: 'abbot-bow-portrait',
    durationMs: 7600,
    actionParams: Object.freeze({
      startPosition: Object.freeze([6.7, 4.2, 0.3]),
      endPosition: Object.freeze([5.2, 3.85, 0.15]),
      target: Object.freeze([2.85, 1.75, -3.65]),
      startFov: 51,
      endFov: 46
    })
  }),
  Object.freeze({
    name: 'devotee-tracking',
    subject: 'Live worshipper and procession',
    action: 'devotee-tracking',
    durationMs: 8200,
    actionParams: Object.freeze({
      followOffset: Object.freeze([-6.2, 3.7, 4.8]),
      lookOffset: Object.freeze([0, 1.25, 0]),
      fallbackStart: Object.freeze([-10.5, 5.8, 12.5]),
      fallbackEnd: Object.freeze([-7.2, 5.1, 5.2]),
      fallbackLookStart: Object.freeze([-2.4, 1.8, -1.0]),
      fallbackLookEnd: Object.freeze([0, 2.2, -3.8]),
      fov: 52
    })
  }),
  Object.freeze({
    name: 'hall-crane-reveal',
    subject: 'Full sanctuary reveal',
    action: 'hall-crane-reveal',
    durationMs: 9000,
    actionParams: Object.freeze({
      // Keep the establishing move below the unfinished roofline. The
      // shallow downward angle frames the altar, columns and finished fascia.
      startPosition: Object.freeze([0, 7.8, 18.5]),
      endPosition: Object.freeze([-0.8, 7.1, 16.5]),
      startLookAt: Object.freeze([0, 3.25, -3.8]),
      endLookAt: Object.freeze([0.8, 3.1, -5.0]),
      startFov: 42,
      endFov: 40.3
    })
  }),
  Object.freeze({
    name: 'left-aisle-dolly',
    subject: 'Left side gallery and worshippers',
    action: 'left-aisle-dolly',
    durationMs: 7800,
    actionParams: Object.freeze({
      startPosition: Object.freeze([-12.5, 7.1, 10.5]),
      endPosition: Object.freeze([-7.2, 6.2, 3.1]),
      startLookAt: Object.freeze([-4.1, 2.0, -2.0]),
      endLookAt: Object.freeze([0, 2.7, -5.3]),
      fov: 55
    })
  }),
  Object.freeze({
    name: 'right-aisle-dolly',
    subject: 'Right side gallery and resident abbot',
    action: 'right-aisle-dolly',
    durationMs: 7800,
    actionParams: Object.freeze({
      startPosition: Object.freeze([12.2, 7.8, 13.0]),
      endPosition: Object.freeze([7.4, 6.1, 3.8]),
      startLookAt: Object.freeze([3.8, 2.2, -1.2]),
      endLookAt: Object.freeze([0, 2.5, -5.0]),
      fov: 55
    })
  }),
  Object.freeze({
    name: 'hall-overview-orbit',
    subject: 'Elevated full hall panorama',
    action: 'hall-overview-orbit',
    durationMs: 9200,
    actionParams: Object.freeze({
      // A restrained elevated arc: never climb above the completed columns
      // or point the lens into the roofless/unbuilt upper environment.
      center: Object.freeze([0, 3.3, -3.5]),
      radius: 18.2,
      height: 9.5,
      startAngle: -0.28,
      sweep: 0.56,
      fov: 46
    })
  })
]);

 
// Weighted recurring schedule: establishing/environment/statue shots dominate;
// character-focused shots remain occasional supporting coverage.
export const TEMPLE_CAMERA_SHOT_SEQUENCE = Object.freeze([
  'hall-crane-reveal',
  'left-aisle-dolly',
  'buddha-pov-pan',
  'hall-overview-orbit',
  'right-aisle-dolly',
  'buddha-orbit',
  'left-aisle-dolly',
  'hall-crane-reveal',
  'devotee-tracking',
  'buddha-pov-pan',
  'right-aisle-dolly',
  'hall-overview-orbit',
  'left-aisle-dolly',
  'abbot-bow-portrait',
  'hall-crane-reveal',
  'buddha-pov-pan'
]);

export function getTempleCameraShotFrame(shot, elapsedMs, context = {}) {
  if (!shot || typeof shot !== 'object') throw new TypeError('A camera shot definition is required');
  const action = SHOT_ACTIONS[shot.action];
  if (typeof action !== 'function') throw new RangeError(`Unknown temple camera action: ${shot.action}`);
  const duration = Number.isFinite(shot.durationMs) && shot.durationMs > 0 ? shot.durationMs : 1;
  const progress = clamp01(Math.max(0, Number(elapsedMs) || 0) / duration);
  const frame = action(shot, progress, context);
  return {
    action: shot.action,
    subject: shot.subject,
    progress,
    position: frame.position,
    lookAt: frame.lookAt,
    fov: frame.fov
  };
}

// Retained for older diagnostics/tests that use index-based shot sequencing.
export function getTempleRitualShotIndex(startIndex, elapsedMs, durationMs, shotCount = TEMPLE_CAMERA_RITUAL_PRESETS.length) {
  const count = Math.max(1, Math.trunc(Number(shotCount)) || 1);
  const rawStart = Math.trunc(Number(startIndex)) || 0;
  const start = ((rawStart % count) + count) % count;
  const duration = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : count;
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  const progress = Math.min(0.999999, elapsed / duration);
  const step = Math.min(count - 1, Math.floor(progress * count));
  return (start + step) % count;
}
