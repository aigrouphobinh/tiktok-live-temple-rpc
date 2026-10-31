import { CharacterStateMachine } from './character-state-machine.js';

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
  const EFFECT_DURATION = { rocket: 4050, dragon: 4200, donut: 3650 };
  let activeTimer = 0;
  let phaseTimers = [];
  let effectTimer = 0;
  let cooldownTimer = 0;
  let effectToken = 0;
  let characterAnimation = null;

  function normalizedName(event) {
    return String(event?.giftName || '').normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  function giftAction(event) {
    const name = normalizedName(event);
    if (/\b(rocket|ten lua)\b/.test(name)) return 'rocket';
    if (/\b(dragon|rong)\b/.test(name)) return 'dragon';
    if (/\b(donut|doughnut)\b/.test(name)) return 'donut';
    return null;
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
    animation.finished.catch(() => {}).finally(() => el.remove());
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

  function playRocket(token) {
    const rocket = createEffect('gift-rocket', '🚀', 95, 1010);
    const flight = rocket.animate([
      { transform: 'translate3d(0, 0, 0) rotate(-24deg) scale(.65)', opacity: 0 },
      { transform: 'translate3d(180px, -40px, 0) rotate(-10deg) scale(1)', opacity: 1, offset: .3 },
      { transform: 'translate3d(430px, -20px, 0) rotate(8deg) scale(1.25)', opacity: 1 },
      { transform: 'translate3d(500px, 0, 0) rotate(14deg) scale(.4)', opacity: 0 }
    ], { duration: 850, easing: 'ease-in', fill: 'forwards' });
    removeAfter(rocket, flight);

    window.setTimeout(() => {
      if (token !== effectToken) return;
      const blast = createEffect('gift-blast', '💥', 490, 900);
      const pop = blast.animate([
        { transform: 'translate3d(0,0,0) scale(.2)', opacity: 0 },
        { transform: 'translate3d(0,0,0) scale(1.55)', opacity: 1, offset: .35 },
        { transform: 'translate3d(0,0,0) scale(2.1)', opacity: 0 }
      ], { duration: 760, easing: 'ease-out', fill: 'forwards' });
      removeAfter(blast, pop);
      animateCharacter([
        { transform: 'translate3d(0,0,0) rotate(0deg) scale(1)' },
        { transform: 'translate3d(310px,-170px,0) rotate(28deg) scale(.82)', offset: .42 },
        { transform: 'translate3d(310px,-170px,0) rotate(28deg) scale(.82)', offset: .68 },
        { transform: 'translate3d(0,0,0) rotate(0deg) scale(1)' }
      ], 3300);
    }, 620);
  }

  function playDragon() {
    const dragon = createEffect('gift-dragon', '🐉', 65, 820);
    const flight = dragon.animate([
      { transform: 'translate3d(0,0,0) scale(.35) rotate(-12deg)', opacity: 0 },
      { transform: 'translate3d(240px,-90px,0) scale(1.05) rotate(8deg)', opacity: 1, offset: .35 },
      { transform: 'translate3d(610px,-35px,0) scale(1.2) rotate(18deg)', opacity: 1, offset: .72 },
      { transform: 'translate3d(970px,25px,0) scale(.65) rotate(28deg)', opacity: 0 }
    ], { duration: 3100, easing: 'ease-in-out', fill: 'forwards' });
    removeAfter(dragon, flight);
    const wind = createEffect('gift-dragon-wind', '💨', 470, 930);
    const gust = wind.animate([
      { transform: 'translate3d(0,0,0) scale(.25)', opacity: 0 },
      { transform: 'translate3d(80px,-35px,0) scale(1.5)', opacity: .9, offset: .35 },
      { transform: 'translate3d(340px,-80px,0) scale(2.2)', opacity: 0 }
    ], { duration: 1700, delay: 650, easing: 'ease-out', fill: 'forwards' });
    removeAfter(wind, gust);
    animateCharacter([
      { transform: 'translate3d(0,0,0) rotate(0deg) scale(1)' },
      { transform: 'translate3d(175px,-85px,0) rotate(14deg) scale(.9)', offset: .38 },
      { transform: 'translate3d(175px,-85px,0) rotate(14deg) scale(.9)', offset: .65 },
      { transform: 'translate3d(0,0,0) rotate(0deg) scale(1)' }
    ], 3200);
  }

  function playDonut() {
    const donut = createEffect('gift-donut', '🍩', 95, 850);
    const fly = donut.animate([
      { transform: 'translate3d(0,0,0) rotate(0deg) scale(.55)', opacity: 0 },
      { transform: 'translate3d(330px,-55px,0) rotate(-130deg) scale(1.15)', opacity: 1, offset: .38 },
      { transform: 'translate3d(600px,20px,0) rotate(-260deg) scale(1)', opacity: 1, offset: .68 },
      { transform: 'translate3d(900px,-10px,0) rotate(-430deg) scale(.7)', opacity: 0 }
    ], { duration: 2200, easing: 'ease-in-out', fill: 'forwards' });
    removeAfter(donut, fly);
    animateCharacter([
      { transform: 'translate3d(0,0,0) scale(1)' },
      { transform: 'translate3d(160px,-12px,0) rotate(8deg) scale(1.02)', offset: .25 },
      { transform: 'translate3d(300px,-30px,0) rotate(12deg) scale(1.02)', offset: .7 },
      { transform: 'translate3d(0,0,0) rotate(0deg) scale(1)' }
    ], 3600);
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
        : '🍩 Bị chiếc bánh donut dụ chạy khỏi lư hương!';
  }

  function startCharacterTimer(event) {
    clearTimeout(activeTimer);
    phaseTimers.forEach(clearTimeout);
    phaseTimers = [
      window.setTimeout(() => machine.transition('OFFERING'), 2100),
      window.setTimeout(() => machine.transition('BOWING'), 2370)
    ];
    activeTimer = window.setTimeout(() => {
      phaseTimers.forEach(clearTimeout);
      phaseTimers = [];
      const next = machine.completeActive();
      if (next.started) {
        window.dispatchEvent(new CustomEvent('temple:character-start', { detail: next.event }));
        startCharacterTimer(next.event);
      }
    }, event?.type === 'drawFortune' ? 18000 : 7600);
  }

  function beginEffect(action) {
    clearTimeout(activeTimer);
    phaseTimers.forEach(clearTimeout);
    phaseTimers = [];
    clearTimeout(effectTimer);
    clearTimeout(cooldownTimer);
    const token = ++effectToken;
    showActionLabel(action);
    if (action === 'rocket') playRocket(token);
    else if (action === 'dragon') playDragon();
    else if (action === 'donut') playDonut();

    effectTimer = window.setTimeout(() => {
      if (token !== effectToken) return;
      characterAnimation?.cancel();
      characterAnimation = null;
      const result = machine.finishEffect();
      if (result.nextEffect) {
        beginEffect(result.nextEffect.action);
        return;
      }
      cooldownTimer = window.setTimeout(() => {
        const next = machine.finishCooldown();
        if (next.started) {
          window.dispatchEvent(new CustomEvent('temple:character-start', { detail: next.event }));
          startCharacterTimer(next.event);
        }
      }, 650);
    }, EFFECT_DURATION[action] || 3500);
  }

  function handle(event) {
    if (!event || typeof event.type !== 'string') return { allowWalker: false };
    const action = ['offerGift', 'grandCeremony'].includes(event.type) ? giftAction(event) : null;

    if (action) {
      const result = machine.interrupt(action, event);
      if (result.interrupted) {
        beginEffect(action);
        return { allowWalker: false, interruptsRitual: true, action, state: machine.snapshot() };
      }
      if (result.queuedEffect) {
        return { allowWalker: false, queuedEffect: true, action, state: machine.snapshot() };
      }
      // No character is currently at the altar: treat this gift as an ordinary visit.
    }

    if (!WALK_EVENTS.has(event.type)) return { allowWalker: false, state: machine.snapshot() };
    const result = machine.request(event);
    if (!result.accepted) return { allowWalker: false, dropped: true, state: machine.snapshot() };
    if (result.started) startCharacterTimer(event);
    return { allowWalker: Boolean(result.started), queued: Boolean(result.queued), state: machine.snapshot() };
  }

  window.TempleGiftActionEngine = {
    handle,
    snapshot: () => machine.snapshot()
  };
})();
