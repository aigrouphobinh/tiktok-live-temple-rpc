import { CharacterStateMachine } from './character-state-machine.js';
import { resolveGiftAction, resolveGiftReactionProfile, resolveGiftVfxProfile, resolveGiftEffectDurationMs } from './gift-action-rules.js';
import { GiftStreakCoalescer } from './gift-streak-coalescer.js';
import { GiftEffectRegistry } from './gift-effect-registry.js';

/**
 * Single-owner visual controller for the central devotee.
 * Server rewards remain event-driven and are deliberately not changed here.
 */
(() => {
  const stage = document.getElementById('stage9x16');
  if (!stage) return;

  const layer = document.createElement('div');
  layer.className = 'gift-action-layer';
  const rig = stage.querySelector(':scope > .temple-camera-rig') || stage;
  rig.appendChild(layer);

  const machine = new CharacterStateMachine({ maxQueue: 40 });
  const WALK_EVENTS = new Set(['burnIncense', 'sendPrayer', 'offerGift', 'grandCeremony', 'ringBell', 'drawFortune']);
  const EFFECT_DURATION = { rocket: 4050, dragon: 4200, donut: 3650, rose: 2600 };
  const streakCoalescer = new GiftStreakCoalescer({ ttlMs: 5000, maxEntries: 200 });
  let activeTimer = 0;
  let phaseTimers = [];
  // Generation tokens make already-queued callbacks harmless after ownership changes.
  let ritualToken = 0;
  let effectTimer = 0;
  let cooldownTimer = 0;
  let delayedEffectTimers = [];
  let effectToken = 0;
  let characterAnimation = null;
  const effectRegistry = new GiftEffectRegistry();

  function playGiftSound(type, effectId) {
    window.dispatchEvent(new CustomEvent('temple:gift-sfx', { detail: { type, effectId } }));
  }

  function createEffect(className, symbol, x, y) {
    const el = document.createElement('div');
    el.className = `gift-action-fx ${className}`;
    el.textContent = symbol;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    layer.appendChild(el);
    return el;
  }

  function removeAfter(el, animation) {
    effectRegistry.track(el, animation);
  }

  function clearActiveEffects() {
    effectRegistry.clear();
  }

  function clearDelayedEffectTimers() {
    delayedEffectTimers.forEach(clearTimeout);
    delayedEffectTimers = [];
  }

  function scheduleEffectCallback(token, callback, delay) {
    const timer = window.setTimeout(() => {
      delayedEffectTimers = delayedEffectTimers.filter((id) => id !== timer);
      if (token !== effectToken) return;
      callback();
    }, delay);
    delayedEffectTimers.push(timer);
    return timer;
  }

  function hideCentralCharacterAfter(token, delay) {
    scheduleEffectCallback(token, () => {
      const sprite = document.getElementById('centralSpriteStack');
      if (sprite) sprite.style.visibility = 'hidden';
    }, delay);
  }

  function animateCharacter(keyframes, duration) {
    const sprite = document.getElementById('centralSpriteStack');
    if (!sprite) return;
    characterAnimation?.cancel();
    characterAnimation = sprite.animate(keyframes, {
      duration,
      easing: 'cubic-bezier(0.18, 0.72, 0.24, 1)',
      fill: 'none'
    });
  }

  function playRocket(token, hasTarget = false, vfx = {}) {
    const scale = Number.isFinite(vfx.scale) ? vfx.scale : 1;
    const durationScale = Number.isFinite(vfx.durationScale) ? vfx.durationScale : 1;
    const sparkCount = Math.min(52, Math.max(10, Math.round((vfx.particles || 18) * 1.05)));
    const shockwaveCount = Math.min(4, Math.max(1, Math.floor(vfx.shockwaves || 1)));
    playGiftSound('rocket-launch', token);
    const rocket = createEffect('gift-rocket', '', 95, 1010);
    const flight = rocket.animate([
      { transform: 'translate3d(0, 0, 0) rotate(-24deg) scale(.65)', opacity: 0 },
      { transform: 'translate3d(180px, -40px, 0) rotate(-10deg) scale(1)', opacity: 1, offset: .3 },
      { transform: 'translate3d(430px, -20px, 0) rotate(8deg) scale(1.25)', opacity: 1 },
      { transform: 'translate3d(500px, 0, 0) rotate(14deg) scale(.4)', opacity: 0 }
    ], { duration: Math.round(850 * durationScale), easing: 'ease-in', fill: 'forwards' });
    removeAfter(rocket, flight);

    // Procedural exhaust trail: warm flame cores with soft smoke tails.
    for (let i = 0; i < Math.round(10 * scale); i++) {
      const trail = createEffect('gift-rocket-trail', '', 82 + i * 12, 1005 + (Math.random() - 0.5) * 24);
      const drift = -90 - Math.random() * 120;
      const rise = -22 - Math.random() * 52;
      const trailAnim = trail.animate([
        { transform: 'translate3d(0,0,0) scale(.55)', opacity: .92 },
        { transform: `translate3d(${drift}px,${rise}px,0) scale(1.6)`, opacity: 0 }
      ], { duration: 520 + Math.random() * 240, delay: i * 28, easing: 'ease-out', fill: 'forwards' });
      removeAfter(trail, trailAnim);
    }

    scheduleEffectCallback(token, () => {
      playGiftSound('explosion', token);
      const blast = createEffect('gift-blast', '💥', 595, 1010);
      blast.style.fontSize = `${Math.round(112 * scale)}px`;
      blast.style.filter = 'drop-shadow(0 0 18px rgba(255,190,55,.95))';
      const flash = createEffect('gift-impact-flash', '', 595, 1010);
      const flashAnim = flash.animate([
        { transform: 'scale(.2)', opacity: .95 },
        { transform: `scale(${3.8 * scale})`, opacity: 0 }
      ], { duration: Math.round(430 * durationScale), easing: 'ease-out', fill: 'forwards' });
      removeAfter(flash, flashAnim);

      for (let waveIndex = 0; waveIndex < shockwaveCount; waveIndex++) {
        const shockwave = createEffect('gift-shockwave', '', 595, 1010);
        const waveScale = 8 * scale * (1 + waveIndex * 0.18);
        Object.assign(shockwave.style, {
          width: `${34 + waveIndex * 10}px`, height: `${34 + waveIndex * 10}px`,
          margin: `${-17 - waveIndex * 5}px 0 0 ${-17 - waveIndex * 5}px`,
          border: `${9 - Math.min(4, waveIndex)}px solid rgba(255,220,120,.95)`,
          borderRadius: '50%', boxSizing: 'border-box',
          boxShadow: '0 0 30px rgba(255,110,25,.9)'
        });
        const wave = shockwave.animate([
          { transform: 'scale(.25)', opacity: .95, borderWidth: '9px' },
          { transform: `scale(${waveScale})`, opacity: 0, borderWidth: '1px' }
        ], { duration: Math.round((820 + waveIndex * 90) * durationScale), delay: waveIndex * 105, easing: 'cubic-bezier(.12,.72,.24,1)', fill: 'forwards' });
        removeAfter(shockwave, wave);
      }

      // Soft smoke puffs and small debris add depth to the impact without a heavy texture.
      for (let i = 0; i < Math.min(12, Math.max(5, Math.round(7 * scale))); i++) {
        const smoke = createEffect('gift-blast-smoke', '', 595 + (Math.random() - .5) * 70, 1010 + (Math.random() - .5) * 55);
        const smokeAnim = smoke.animate([
          { transform: 'scale(.35)', opacity: .48 },
          { transform: `translate3d(${(Math.random() - .5) * 120}px,-${70 + Math.random() * 90}px,0) scale(2.4)`, opacity: 0 }
        ], { duration: 1050 + Math.random() * 350, easing: 'ease-out', fill: 'forwards' });
        removeAfter(smoke, smokeAnim);
      }
      for (let i = 0; i < Math.min(16, Math.max(8, Math.round(8 * scale))); i++) {
        const debris = createEffect('gift-blast-debris', '', 595, 1010);
        const angle = (Math.PI * 2 * i) / 8;
        const distance = 110 + Math.random() * 90;
        const debrisAnim = debris.animate([
          { transform: 'scale(.4) rotate(0deg)', opacity: 1 },
          { transform: `translate3d(${Math.cos(angle) * distance}px,${Math.sin(angle) * distance}px,0) scale(.2) rotate(220deg)`, opacity: 0 }
        ], { duration: 720 + Math.random() * 260, easing: 'ease-out', fill: 'forwards' });
        removeAfter(debris, debrisAnim);
      }

      for (let i = 0; i < sparkCount; i++) {
        const spark = createEffect('gift-blast-spark', i % 3 === 0 ? '✦' : '•', 595, 1010);
        spark.style.color = i % 2 ? '#fff1a8' : '#ff8b35';
        spark.style.fontSize = i % 3 ? '28px' : '42px';
        const angle = (Math.PI * 2 * i) / sparkCount;
        const distance = 90 + Math.random() * 170;
        const dx = Math.cos(angle) * distance;
        const dy = Math.sin(angle) * distance;
        const sparkAnim = spark.animate([
          { transform: 'translate3d(0,0,0) scale(.3)', opacity: 1 },
          { transform: `translate3d(${dx}px,${dy}px,0) scale(1.15)`, opacity: 0 }
        ], { duration: 650 + Math.random() * 260, easing: 'ease-out', fill: 'forwards' });
        removeAfter(spark, sparkAnim);
      }
      const pop = blast.animate([
        { transform: 'translate3d(0,0,0) scale(.2)', opacity: 0 },
        { transform: 'translate3d(0,0,0) scale(1.55)', opacity: 1, offset: .35 },
        { transform: 'translate3d(0,0,0) scale(2.1)', opacity: 0 }
      ], { duration: 760, easing: 'ease-out', fill: 'forwards' });
      removeAfter(blast, pop);
      if (hasTarget) {
        animateCharacter([
          { transform: 'translate3d(0,0,0) rotate(0deg) scale(1)', opacity: 1 },
          { transform: 'translate3d(145px,-95px,0) rotate(10deg) scale(.96)', opacity: 1, offset: .25 },
          { transform: 'translate3d(390px,-270px,0) rotate(34deg) scale(.72)', opacity: .9, offset: .62 },
          { transform: 'translate3d(700px,-560px,0) rotate(72deg) scale(.18)', opacity: 0 }
        ], 1220);
        hideCentralCharacterAfter(token, 1160);
      }
    }, Math.round(620 * durationScale));
  }

  function playDragon(token, vfx = {}) {
    const scale = Number.isFinite(vfx.scale) ? vfx.scale : 1;
    const durationScale = Number.isFinite(vfx.durationScale) ? vfx.durationScale : 1;
    playGiftSound('dragon-whoosh', token);
    const dragon = createEffect('gift-dragon', '', 65, 820);
    dragon.style.width = `${270 * scale}px`;
    dragon.style.height = `${150 * scale}px`;
    const flight = dragon.animate([
      { transform: 'translate3d(0,0,0) scale(.35) rotate(-12deg)', opacity: 0 },
      { transform: 'translate3d(240px,-90px,0) scale(1.05) rotate(8deg)', opacity: 1, offset: .35 },
      { transform: 'translate3d(610px,-35px,0) scale(1.2) rotate(18deg)', opacity: 1, offset: .72 },
      { transform: 'translate3d(970px,25px,0) scale(.65) rotate(28deg)', opacity: 0 }
    ], { duration: Math.round(3100 * durationScale), easing: 'ease-in-out', fill: 'forwards' });
    removeAfter(dragon, flight);
    const wind = createEffect('gift-dragon-wind', '💨', 470, 930);
    const gust = wind.animate([
      { transform: 'translate3d(0,0,0) scale(.25)', opacity: 0 },
      { transform: 'translate3d(80px,-35px,0) scale(1.5)', opacity: .9, offset: .35 },
      { transform: 'translate3d(340px,-80px,0) scale(2.2)', opacity: 0 }
    ], { duration: Math.round(1700 * durationScale), delay: 650, easing: 'ease-out', fill: 'forwards' });
    removeAfter(wind, gust);
    scheduleEffectCallback(token, () => {
      playGiftSound('dragon-roar', token);
      const impact = createEffect('gift-dragon-impact', '', 540, 955);
      const impactAnim = impact.animate([
        { transform: 'scale(.25)', opacity: .9 },
        { transform: `scale(${5.2 * scale})`, opacity: 0 }
      ], { duration: Math.round(780 * durationScale), easing: 'ease-out', fill: 'forwards' });
      removeAfter(impact, impactAnim);
    }, 850);
    animateCharacter([
      { transform: 'translate3d(0,0,0) rotate(0deg) scale(1)' },
      { transform: 'translate3d(175px,-85px,0) rotate(14deg) scale(.9)', offset: .38 },
      { transform: 'translate3d(175px,-85px,0) rotate(14deg) scale(.9)', offset: .65 },
      { transform: 'translate3d(0,0,0) rotate(0deg) scale(1)' }
    ], Math.round(3200 * durationScale));
  }

  function playRose(token, vfx = {}) {
    const scale = Number.isFinite(vfx.scale) ? vfx.scale : 1;
    const durationScale = Number.isFinite(vfx.durationScale) ? vfx.durationScale : 1;
    playGiftSound('rose-chime', token);
    const rose = createEffect('gift-rose-main', '🌹', 540, 850);
    rose.style.fontSize = `${112 * scale}px`;
    const main = rose.animate([
      { transform: 'translate3d(0,35px,0) scale(.35) rotate(-18deg)', opacity: 0 },
      { transform: 'translate3d(0,-35px,0) scale(1.12) rotate(8deg)', opacity: 1, offset: .45 },
      { transform: 'translate3d(0,-130px,0) scale(.78) rotate(18deg)', opacity: 0 }
    ], { duration: Math.round(1900 * durationScale), easing: 'ease-out', fill: 'forwards' });
    removeAfter(rose, main);
    for (let i = 0; i < Math.min(30, Math.max(9, Math.round(9 * scale * 1.6))); i++) {
      const petal = createEffect('gift-rose-petal', i % 2 ? '🌸' : '🌺', 540, 860);
      const dx = (Math.random() - .5) * 330;
      const dy = -90 - Math.random() * 240;
      const spin = (Math.random() - .5) * 100;
      const anim = petal.animate([
        { transform: 'translate3d(0,0,0) rotate(0deg) scale(.35)', opacity: 0 },
        { transform: `translate3d(${dx * .45}px,${dy * .45}px,0) rotate(${spin}deg) scale(.8)`, opacity: .95, offset: .4 },
        { transform: `translate3d(${dx}px,${dy}px,0) rotate(${spin * 2}deg) scale(.45)`, opacity: 0 }
      ], { duration: Math.round((1800 + Math.random() * 500) * durationScale), delay: i * 35, easing: 'ease-out', fill: 'forwards' });
      removeAfter(petal, anim);
    }
  }

  function showComboPulse(count, profile = null) {
    const vfx = resolveGiftVfxProfile(profile || {});
    const pulse = createEffect('gift-combo-pulse', `COMBO ×${Math.max(1, count)} · ${vfx.tier.toUpperCase()}`, 540, 760);
    pulse.style.fontSize = `${38 * vfx.scale}px`;
    const anim = pulse.animate([
      { transform: 'translate3d(0,12px,0) scale(.65)', opacity: 0 },
      { transform: 'translate3d(0,-18px,0) scale(1.08)', opacity: 1, offset: .35 },
      { transform: 'translate3d(0,-58px,0) scale(.9)', opacity: 0 }
    ], { duration: 850, easing: 'ease-out', fill: 'forwards' });
    removeAfter(pulse, anim);
  }

  function playDonut(token, hasTarget = false, vfx = {}) {
    const scale = Number.isFinite(vfx.scale) ? vfx.scale : 1;
    const durationScale = Number.isFinite(vfx.durationScale) ? vfx.durationScale : 1;
    playGiftSound('donut-chime', token);
    // Keep the treat on the upper-middle lane: it teases the devotee without
    // sweeping across the altar, Buddha focal point, or fixed HUD.
    const donut = createEffect('gift-donut', '', 70, 790);
    donut.style.width = `${116 * scale}px`;
    donut.style.height = `${116 * scale}px`;
    const fly = donut.animate([
      { transform: 'translate3d(0,34px,0) rotate(-35deg) scale(.48)', opacity: 0 },
      { transform: 'translate3d(205px,-42px,0) rotate(95deg) scale(1.02)', opacity: 1, offset: .22 },
      { transform: 'translate3d(430px,24px,0) rotate(230deg) scale(.92)', opacity: 1, offset: .48 },
      { transform: 'translate3d(660px,-38px,0) rotate(390deg) scale(1.04)', opacity: 1, offset: .76 },
      { transform: 'translate3d(850px,12px,0) rotate(560deg) scale(.62)', opacity: 0 }
    ], { duration: Math.round(2700 * durationScale), easing: 'cubic-bezier(.42,0,.24,1)', fill: 'forwards' });
    removeAfter(donut, fly);

    if (hasTarget) {
      // Follow the treat down the right aisle and leave the altar frame.
      animateCharacter([
        { transform: 'translate3d(0,0,0) rotate(0deg) scale(1)', opacity: 1 },
        { transform: 'translate3d(90px,-12px,0) rotate(8deg) scale(1.02)', opacity: 1, offset: .18 },
        { transform: 'translate3d(275px,18px,0) rotate(22deg) scale(.98)', opacity: 1, offset: .44 },
        { transform: 'translate3d(485px,58px,0) rotate(48deg) scale(.74)', opacity: .88, offset: .76 },
        { transform: 'translate3d(690px,118px,0) rotate(78deg) scale(.22)', opacity: 0 }
      ], Math.round(2650 * durationScale));
      hideCentralCharacterAfter(token, Math.round(2520 * durationScale));
    }
  }

  function showActionLabel(action) {
    const central = document.getElementById('centralWorshipper');
    if (!central) return;
    central.classList.remove('walking-up');
    const label = document.getElementById('centralAction');
    if (label) label.textContent = action === 'rocket'
      ? '🚀 Bị tên lửa đánh bật khỏi lư hương!'
      : action === 'dragon'
        ? '🐉 Long khí cuộn tới, thí chủ bị đẩy lùi!'
        : action === 'rose'
        ? '🌹 Hương hoa hồng bay quanh thí chủ!'
        : '🍩 Bị chiếc bánh donut dụ chạy khỏi lư hương!';
  }

  function startCharacterTimer(event) {
    clearTimeout(activeTimer);
    phaseTimers.forEach(clearTimeout);
    const token = ++ritualToken;
    phaseTimers = [
      window.setTimeout(() => {
        if (token !== ritualToken) return;
        machine.transition('OFFERING');
      }, 2100),
      window.setTimeout(() => {
        if (token !== ritualToken) return;
        machine.transition('BOWING');
      }, 2370)
    ];
    const ritualDurationMs = window.__TEMPLE_3D_READY__ === true ? 15000 : 12500;
    activeTimer = window.setTimeout(() => {
      if (token !== ritualToken) return;
      phaseTimers.forEach(clearTimeout);
      phaseTimers = [];
      const completedEvent = machine.snapshot().active;
      const next = machine.completeActive();
      if (completedEvent) window.dispatchEvent(new CustomEvent('temple:character-complete', { detail: completedEvent }));
      if (next.started) {
        window.dispatchEvent(new CustomEvent('temple:character-start', { detail: next.event }));
        startCharacterTimer(next.event);
      }
    // Allow an unhurried side entrance, a 6.5s walk from the queue to the altar,
    // and the full three-bow sequence before handing the altar to the next visitor.
    }, event?.type === 'drawFortune' ? 18000 : ritualDurationMs);
  }

  function beginEffect(action, giftEvent = null, { hasTarget = false, targetEjected = false } = {}) {
    // Fade only the superseded gift's sound group; background music and TTS
    // remain on their independent playback paths.
    if (effectToken > 0) {
      window.dispatchEvent(new CustomEvent('temple:gift-sfx', { detail: { type: 'cancel', effectId: effectToken } }));
    }
    // Invalidate any ritual callback that may already be queued by the browser.
    ritualToken++;
    clearTimeout(activeTimer);
    phaseTimers.forEach(clearTimeout);
    phaseTimers = [];
    clearTimeout(effectTimer);
    clearTimeout(cooldownTimer);
    clearDelayedEffectTimers();
    const token = ++effectToken;
    const reactionProfile = resolveGiftReactionProfile(giftEvent || {});
    const vfxProfile = resolveGiftVfxProfile(reactionProfile);
    const effectDurationMs = resolveGiftEffectDurationMs(action, reactionProfile);
    window.dispatchEvent(new CustomEvent('temple:gift-action', { detail: {
      action, effectId: token, hasTarget: Boolean(hasTarget),
      targetEjected: Boolean(targetEjected),
      effectDurationMs,
      handoffDelayMs: 650,
      reactionProfile,
      vfxProfile
    } }));
    clearActiveEffects();
    // Every new gift action owns the central character animation. Cancel the
    // previous action's motion even when the incoming action (e.g. Rose) has
    // no replacement character animation of its own.
    characterAnimation?.cancel();
    characterAnimation = null;
    // A stronger follow-up gift may supersede a chase mid-animation. Keep an
    // already-ejected visitor hidden rather than snapping them back to the altar.
    if (targetEjected && !['rocket', 'donut'].includes(action)) {
      const sprite = document.getElementById('centralSpriteStack');
      if (sprite) sprite.style.visibility = 'hidden';
    }
    showActionLabel(action);
    if (action === 'rocket') playRocket(token, hasTarget, vfxProfile);
    else if (action === 'dragon') playDragon(token, vfxProfile);
    else if (action === 'donut') playDonut(token, hasTarget, vfxProfile);
    else if (action === 'rose') playRose(token, vfxProfile);

    effectTimer = window.setTimeout(() => {
      if (token !== effectToken) return;
      characterAnimation?.cancel();
      characterAnimation = null;
      const result = machine.finishEffect();
      if (result.nextEffect) {
        beginEffect(result.nextEffect.action, result.nextEffect.event, {
          hasTarget: Boolean(result.ejectedDevotee),
          targetEjected: Boolean(result.ejectedDevotee)
        });
        return;
      }
      cooldownTimer = window.setTimeout(() => {
        if (token !== effectToken) return;
        const next = machine.finishCooldown();
        if (next.started) {
          window.dispatchEvent(new CustomEvent('temple:character-start', { detail: next.event }));
          startCharacterTimer(next.event);
        } else {
          window.dispatchEvent(new CustomEvent('temple:gift-effects-complete', {
            detail: { effectId: token, action }
          }));
        }
      }, 650);
    }, effectDurationMs);
  }

  function handle(event) {
    if (!event || typeof event.type !== 'string') return { allowWalker: false };
    const action = ['offerGift', 'grandCeremony'].includes(event.type) ? resolveGiftAction(event) : null;

    if (action) {
      // Coalesce cumulative connector frames for a single streakable gift.
      if (streakCoalescer.shouldCoalesce(event)) {
        const reactionProfile = resolveGiftReactionProfile(event);
        showComboPulse(event.giftComboDelta || 1, reactionProfile);
        window.dispatchEvent(new CustomEvent('temple:gift-reaction', { detail: { action, reactionProfile } }));
        return { allowWalker: false, coalescedCombo: true, action, state: machine.snapshot() };
      }
      const interruptedEvent = machine.snapshot().active;
      const result = machine.interrupt(action, event);
      if (result.interrupted) {
        if (interruptedEvent && !result.superseded) {
          window.dispatchEvent(new CustomEvent('temple:character-interrupted', { detail: { event: interruptedEvent, action } }));
        }
        const targetEjected = Boolean(result.ejectedDevotee);
        const hasTarget = Boolean(interruptedEvent || targetEjected);
        beginEffect(action, event, { hasTarget, targetEjected });
        return { allowWalker: false, interruptsRitual: true, action, ejectedDevotee: hasTarget, state: machine.snapshot() };
      }
      if (result.queuedEffect) {
        return { allowWalker: false, queuedEffect: true, action, state: machine.snapshot() };
      }
      // No character is currently at the altar: treat this gift as an ordinary visit.
    }

    if (!WALK_EVENTS.has(event.type)) return { allowWalker: false, state: machine.snapshot() };
    const result = machine.request(event);
    if (!result.accepted) return { allowWalker: false, dropped: true, state: machine.snapshot() };
    if (result.started) {
      startCharacterTimer(event);
      window.dispatchEvent(new CustomEvent('temple:character-start', { detail: event }));
    }
    return { allowWalker: false, started: Boolean(result.started), queued: Boolean(result.queued), state: machine.snapshot() };
  }

  window.TempleGiftActionEngine = {
    handle,
    resetStreaks: () => streakCoalescer.clear(),
    clearStreak: (groupId) => {
      if (groupId == null || String(groupId) === '') return false;
      return streakCoalescer.clearStreak(groupId);
    },
    snapshot: () => machine.snapshot()
  };
})();
