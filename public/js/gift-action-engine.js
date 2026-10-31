/**
 * Lightweight gift actions for the existing central devotee.
 * Only verified gift-name aliases are used here; gift IDs are carried through
 * from TikTok for later configuration but are not guessed.
 */
(() => {
  const stage = document.getElementById('stage9x16');
  if (!stage) return;

  const layer = document.createElement('div');
  layer.className = 'gift-action-layer';
  const rig = stage.querySelector(':scope > .temple-camera-rig') || stage;
  rig.appendChild(layer);

  let activeIncenseUntil = 0;
  let effectToken = 0;
  let characterAnimation = null;

  function normalizedName(event) {
    return String(event?.giftName || '').normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
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

  function removeAfter(el, animation, token) {
    animation.finished.catch(() => {}).finally(() => {
      if (token === effectToken) el.remove();
    });
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

  function rocketInterrupt() {
    const token = ++effectToken;
    const rocket = createEffect('gift-rocket', '🚀', 95, 1010);
    const flight = rocket.animate([
      { transform: 'translate3d(0, 0, 0) rotate(-24deg) scale(.65)', opacity: 0 },
      { transform: 'translate3d(180px, -40px, 0) rotate(-10deg) scale(1)', opacity: 1, offset: .3 },
      { transform: 'translate3d(430px, -20px, 0) rotate(8deg) scale(1.25)', opacity: 1 },
      { transform: 'translate3d(500px, 0, 0) rotate(14deg) scale(.4)', opacity: 0 }
    ], { duration: 850, easing: 'ease-in', fill: 'forwards' });
    removeAfter(rocket, flight, token);

    window.setTimeout(() => {
      if (token !== effectToken) return;
      const blast = createEffect('gift-blast', '💥', 490, 900);
      const pop = blast.animate([
        { transform: 'translate3d(0,0,0) scale(.2)', opacity: 0 },
        { transform: 'translate3d(0,0,0) scale(1.55)', opacity: 1, offset: .35 },
        { transform: 'translate3d(0,0,0) scale(2.1)', opacity: 0 }
      ], { duration: 760, easing: 'ease-out', fill: 'forwards' });
      removeAfter(blast, pop, token);
      animateCharacter([
        { transform: 'translate3d(0,0,0) rotate(0deg) scale(1)' },
        { transform: 'translate3d(310px,-170px,0) rotate(28deg) scale(.82)', offset: .42 },
        { transform: 'translate3d(310px,-170px,0) rotate(28deg) scale(.82)', offset: .68 },
        { transform: 'translate3d(0,0,0) rotate(0deg) scale(1)' }
      ], 3300);
    }, 620);
  }

  function donutTemptation() {
    const token = ++effectToken;
    const donut = createEffect('gift-donut', '🍩', 920, 850);
    const fly = donut.animate([
      { transform: 'translate3d(0,0,0) rotate(0deg) scale(.55)', opacity: 0 },
      { transform: 'translate3d(-360px,-55px,0) rotate(-130deg) scale(1.15)', opacity: 1, offset: .38 },
      { transform: 'translate3d(-600px,20px,0) rotate(-260deg) scale(1)', opacity: 1, offset: .68 },
      { transform: 'translate3d(-920px,-10px,0) rotate(-430deg) scale(.7)', opacity: 0 }
    ], { duration: 2200, easing: 'ease-in-out', fill: 'forwards' });
    removeAfter(donut, fly, token);
    animateCharacter([
      { transform: 'translate3d(0,0,0) scale(1)' },
      { transform: 'translate3d(160px,-12px,0) rotate(8deg) scale(1.02)', offset: .25 },
      { transform: 'translate3d(300px,-30px,0) rotate(12deg) scale(1.02)', offset: .7 },
      { transform: 'translate3d(0,0,0) rotate(0deg) scale(1)' }
    ], 3600);
  }

  function handle(event) {
    if (!event || typeof event.type !== 'string') return { interruptsRitual: false };
    if (event.type === 'burnIncense') {
      activeIncenseUntil = Date.now() + 6800;
      return { interruptsRitual: false };
    }

    if (Date.now() > activeIncenseUntil || !['offerGift', 'grandCeremony'].includes(event.type)) {
      return { interruptsRitual: false };
    }

    const name = normalizedName(event);
    const isRocket = /\b(rocket|ten lua)\b/.test(name);
    const isDonut = /\b(donut|doughnut)\b/.test(name);
    if (!isRocket && !isDonut) return { interruptsRitual: false };

    activeIncenseUntil = 0;
    const central = document.getElementById('centralWorshipper');
    if (central) {
      central.classList.remove('walking-up');
      const action = document.getElementById('centralAction');
      if (action) action.textContent = isRocket
        ? '🚀 Bị tên lửa đánh bật khỏi lư hương!'
        : '🍩 Bị chiếc bánh donut dụ chạy khỏi lư hương!';
      const nameTag = document.getElementById('centralName');
      if (nameTag) nameTag.textContent = nameTag.textContent || 'Thí chủ';
    }

    if (isRocket) rocketInterrupt();
    else donutTemptation();
    return { interruptsRitual: true, action: isRocket ? 'rocket' : 'donut' };
  }

  window.TempleGiftActionEngine = { handle };
})();
