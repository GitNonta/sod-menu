/* SOD! signature — menu site logic
   Static, no build step. All content comes from ./data/menu.json */

(() => {
  'use strict';

  // Bump together with "version" in data/menu.json so browsers drop the cache.
  const ASSET_VERSION = '1.0.5';
  const DATA_URL = './data/menu.json';
  const AUTOPLAY_MS = 6500;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const $ = (id) => document.getElementById(id);

  /* full-bleed sections size themselves with 100vw, which includes the scrollbar;
     publish its width so their edges land exactly on the viewport edges */
  function syncViewportMetrics() {
    const sbw = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    document.documentElement.style.setProperty('--sbw', sbw + 'px');
    // the deck owns the first screen: end it exactly at the fold
    const deck = document.getElementById('promoSlider');
    if (deck) {
      const top = deck.getBoundingClientRect().top + window.scrollY;
      const h = Math.max(340, Math.round(window.innerHeight - top));
      document.documentElement.style.setProperty('--deck-h', h + 'px');
    }
  }
  syncViewportMetrics();
  window.addEventListener('resize', syncViewportMetrics, { passive: true });
  window.addEventListener('load', syncViewportMetrics, { once: true });

  const el = {
    intro: $('intro'),
    introSkip: $('introSkip'),
    themeToggle: $('themeToggle'),
    brandLogo: $('brandLogo'),
    brandSub: $('brandSub'),
    promoNote: $('promoNote'),
    promoLabel: $('promoLabel'),
    tabBefore: $('tabBefore'),
    tabAfter: $('tabAfter'),
    tabBeforeMenu: $('tabBeforeMenu'),
    tabAfterMenu: $('tabAfterMenu'),
    deck: $('promoSlider'),
    track: $('promoTrack'),
    dots: $('promoDots'),
    prev: $('promoPrev'),
    next: $('promoNext'),
    search: $('searchInput'),
    searchClear: $('searchClear'),
    status: $('menuStatus'),
    error: $('menuError'),
    tabs: $('catTabs'),
    body: $('menuBody'),
    footerSub: $('footerSub'),
    footerMeta: $('footerMeta'),
    toTop: $('toTop'),
    toast: $('toast'),
    orderBar: $('orderBar'),
    orderCount: $('orderCount'),
    orderTotal: $('orderTotal'),
    orderNote: $('orderNote'),
    orderOpen: $('orderOpen'),
    mixerSheet: $('mixerSheet'),
    mixerScrim: $('mixerScrim'),
    mixerX: $('mixerX'),
    mixerGrid: $('mixerGrid'),
    mixerSetName: $('mixerSetName'),
    mixerProgress: $('mixerProgress'),
    mixerConfirm: $('mixerConfirm'),
    orderSheet: $('orderSheet'),
    orderScrim: $('orderScrim'),
    orderSheetX: $('orderSheetX'),
    orderList: $('orderList'),
    orderEmpty: $('orderEmpty'),
    sheetTotal: $('sheetTotal'),
    sheetNote: $('sheetNote'),
    splitMinus: $('splitMinus'),
    splitPlus: $('splitPlus'),
    splitPeople: $('splitPeople'),
    splitEach: $('splitEach'),
    orderClear: $('orderClear'),
  };

  const THB = (n) => '฿' + Number(n).toLocaleString('th-TH');

  /* Inline SVG placeholders — used when an item has no image (or it fails to load).
     No emoji, no raster assets: icons inherit the neon accent via currentColor. */
  const svg = (body) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

  const ICONS = {
    mixer: svg(
      '<path d="M6 4h12l-1.7 15.2A2 2 0 0 1 14.3 21H9.7a2 2 0 0 1-2-1.8L6 4Z"/><path d="M5.2 8.5h13.6"/><path d="M14.5 4 17 1"/><circle cx="10" cy="12.5" r="0.7"/><circle cx="13.2" cy="15.5" r="0.7"/>'
    ),
    beer: svg(
      '<path d="M5 7.5h9V19a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7.5Z"/><path d="M14 10h2.5a2.5 2.5 0 0 1 0 5H14"/><path d="M5 11h9"/><path d="M5 7.5c0-2.2 2-3.5 4.5-3.5S14 5.3 14 7.5"/>'
    ),
    spirit: svg(
      '<path d="M10 2h4v3.6c0 1 .4 1.9 1.1 2.6l.5.5c.9.9 1.4 2.1 1.4 3.4V20a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-7.9c0-1.3.5-2.5 1.4-3.4l.5-.5c.7-.7 1.1-1.6 1.1-2.6V2Z"/><path d="M7 14h10"/>'
    ),
    cooler: svg(
      '<path d="M8 3h8c0 4.4-1.8 7.5-4 7.5S8 7.4 8 3Z"/><path d="M12 10.5V20"/><path d="M8.5 21h7"/>'
    ),
    food: svg(
      '<path d="M6 9h12l-1 10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 9Z"/><path d="M9 9V4"/><path d="M12 9V3"/><path d="M15 9V5"/>'
    ),
    other: svg(
      '<path d="M5 7h14l-1.4 12.1A2 2 0 0 1 15.6 21H8.4a2 2 0 0 1-2-1.9L5 7Z"/><path d="M4 7h16"/><path d="M9.5 11.5 12 14l2.5-2.5"/>'
    ),
    default: svg('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/>'),
  };

  const iconMarkup = (key) => ICONS[key] || ICONS.default;

  /* The three.js overlay stays off: on some devices the WebGL canvas painted
     blank/white over the product, so the bottle looked missing ("เหล้าไม่ขึ้น").
     The real product photo is always shown instead — set this to true to try
     the canvas again. */
  const ART3D_ENABLED = false;

  let art3d = null;
  let art3dStarted = false;

  const MODE_KEY = 'sod-promo-mode';
  const MODES = ['before_midnight', 'after_midnight'];

  /* The chosen promo period is remembered so returning visitors do not have to
     flip the switch again; when nothing is stored we fall back to Bangkok time. */
  function readSavedMode() {
    try {
      const saved = localStorage.getItem(MODE_KEY);
      return MODES.includes(saved) ? saved : null;
    } catch (_) {
      return null; /* storage blocked — use the detected period */
    }
  }

  function saveMode(mode) {
    try {
      localStorage.setItem(MODE_KEY, mode);
    } catch (_) {
      /* ignore */
    }
  }

  const state = {
    data: null,
    mode: 'before_midnight',
    slideIndex: 0,
    slides: [],
    promoSlides: [],
    introDone: false,
    scrollLockUntil: 0,
    autoplayId: null,
    pausedUntil: 0,
    deckVisible: true,
    query: '',
    cards: [],
    blocks: [],
    activeCat: null,
  };

  /* ── Intro ─────────────────────────────────────────────────── */
  function startIntro() {
    const finish = () => {
      if (!el.intro || el.intro.classList.contains('is-done')) return;
      el.intro.classList.add('is-done');
      setTimeout(() => el.intro.remove(), 700);
      // let the promo motion graphics start when they are actually visible
      state.introDone = true;
      if (state.slides.length) {
        activateSlide(state.slideIndex, true, true);
        startAutoplay();
      }
    };
    const timer = setTimeout(finish, reduceMotion ? 400 : 1200);
    const skip = () => {
      clearTimeout(timer);
      finish();
    };
    el.introSkip?.addEventListener('click', skip);
    el.intro?.addEventListener('click', (e) => {
      if (e.target === el.intro) skip();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') skip();
    });
  }

  /* ── Theme (light default, dark optional, remembered per device) ── */
  const THEME_KEY = 'sod-theme';
  const THEME_COLORS = { light: '#f7f6f3', dark: '#131211' };

  function applyTheme(theme) {
    const next = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_COLORS[next]);
    if (el.themeToggle) {
      const dark = next === 'dark';
      el.themeToggle.setAttribute('aria-pressed', String(dark));
      el.themeToggle.setAttribute('aria-label', dark ? 'สลับเป็นโหมดสว่าง' : 'สลับเป็นโหมดมืด');
    }
  }

  function wireTheme() {
    let saved = null;
    try {
      saved = localStorage.getItem(THEME_KEY);
    } catch (_) {
      /* storage blocked — stay on the default */
    }
    applyTheme(saved === 'dark' ? 'dark' : 'light');

    el.themeToggle?.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch (_) {
        /* ignore */
      }
    });
  }

  /* ── Toast ─────────────────────────────────────────────────── */
  let toastTimer = null;
  function toast(message) {
    if (!el.toast) return;
    el.toast.textContent = message;
    el.toast.hidden = false;
    requestAnimationFrame(() => el.toast.classList.add('is-visible'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.toast.classList.remove('is-visible');
      setTimeout(() => (el.toast.hidden = true), 320);
    }, 2600);
  }

  /* ── Data loading ──────────────────────────────────────────── */
  async function loadMenu() {
    const res = await fetch(`${DATA_URL}?v=${ASSET_VERSION}`, { cache: 'no-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();

    // If the JSON version moved ahead of the bundled constant, re-fetch cache-busted.
    if (json.version && json.version !== ASSET_VERSION) {
      try {
        const fresh = await fetch(`${DATA_URL}?v=${json.version}`, { cache: 'no-cache' });
        if (fresh.ok) return await fresh.json();
      } catch (_) {
        /* keep first payload */
      }
    }
    return json;
  }

  function applyShop(shop) {
    /* Colours live in style.css (minimal light theme) — the neon `shop.theme`
       values in menu.json are brand reference only, not applied. */
    if (shop.logo && el.brandLogo) el.brandLogo.src = './' + shop.logo.replace(/^\.\//, '');
    if (shop.name_th && el.brandSub) el.brandSub.textContent = shop.name_th;
    if (shop.name_th && el.footerSub) el.footerSub.textContent = shop.name_th;
    if (shop.midnight_note && el.promoNote) el.promoNote.textContent = shop.midnight_note;
    document.title = `${shop.name}${shop.name_th ? ' — ' + shop.name_th : ''} | เมนู & โปรโมชัน`;
  }

  /* ── Promotions ────────────────────────────────────────────── */
  /* the cut-outs already in the package, one of each so the fan looks mixed.
     Schweppes is not part of the promo set, so it is left out of the fan. */
  const MIXER_SRCS = ['./images/coke.webp', './images/sprite.webp', './images/soda-water.webp'];

  /* fan layout of the set graphic: --x is a share of the stage width, --r degrees.
     A spirit set ships with ten mixer bottles, so the fan has ten slots. */
  const FAN = {
    spirit: [
      /* five a side with a gap in the middle: the hero bottle stands in that
         gap, so every one of the ten mixers stays visible */
      { x: -40, r: -16, s: 0.8, y: 34 },
      { x: -32, r: -12, s: 0.85, y: 27 },
      { x: -24, r: -8, s: 0.9, y: 21 },
      { x: -16, r: -4, s: 0.95, y: 14 },
      { x: -7.5, r: -1, s: 1, y: 8 },
      { x: 7.5, r: 1, s: 1, y: 8 },
      { x: 16, r: 4, s: 0.95, y: 14 },
      { x: 24, r: 8, s: 0.9, y: 21 },
      { x: 32, r: 12, s: 0.85, y: 27 },
      { x: 40, r: 16, s: 0.8, y: 34 },
    ],
    beer: [
      { x: -20, r: -11, s: 0.93, y: 8 },
      { x: 20, r: 10, s: 0.93, y: 8 },
    ],
  };

  /* "285 (700ml) + มิกเซอร์ 10 ขวด + น้ำแข็ง 1 ถัง" */
  function setParts(name) {
    const m = name.match(/^(.*?)\s*\+\s*มิกเซอร์\s*(\d+)\s*ขวด\s*\+\s*น้ำแข็ง\s*(\d+)\s*ถัง/);
    return m ? { bottle: m[1], mixers: Number(m[2]), ice: Number(m[3]) } : null;
  }

  function pageKind(slide) {
    if (setParts(slide.name)) return 'spirit';
    if (/ขวดละ/.test(slide.name)) return 'bottle';
    if (/เบียร์/.test(slide.name)) return 'beer';
    return 'bottle';
  }

  function stageHTML(slide) {
    const src = slide.image ? './' + slide.image.replace(/^\.\//, '') : null;
    const art = src
      ? `<img class="slide__art" src="${src}" alt="${escapeAttr(slide.name)}" width="180" height="360" loading="lazy" decoding="async" data-icon="spirit" />`
      : `<div class="slide__icon">${iconMarkup('spirit')}</div>`;
    return `<div class="slide__stage set__stage">
      <span class="slide__ground" aria-hidden="true"></span>
      ${art}
    </div>`;
  }

  function fanHTML(kind, src) {
    const plan = FAN[kind] || FAN.spirit;
    const items = plan.map((_, i) =>
      kind === 'beer' ? src : MIXER_SRCS[i % MIXER_SRCS.length]
    );
    return `<ul class="set__fan" aria-hidden="true">${plan
      .map(
        (p, i) =>
          `<li class="set__mixer" style="--i:${i};--x:${p.x}%;--r:${p.r}deg;--s:${p.s};--y:${p.y}px"><img src="${items[i]}" alt="" width="70" height="210" loading="lazy" decoding="async" /></li>`
      )
      .join('')}</ul>`;
  }

  function setHTML(slide, kind) {
    const src = slide.image ? './' + slide.image.replace(/^\.\//, '') : './images/singha.webp';
    const ice =
      kind === 'spirit'
        ? `<img class="set__ice" src="./images/ice-bucket.webp" alt="น้ำแข็ง ${setParts(slide.name)?.ice || 1} ถัง" width="140" height="140" loading="lazy" decoding="async" />`
        : '';
    return `<div class="set set--${kind}">
      <div class="set__cluster">
        <span class="set__halo" aria-hidden="true"></span>
        <span class="set__floor" aria-hidden="true"></span>
        ${fanHTML(kind, src)}
        <div class="set__bottle">${stageHTML(slide)}</div>
        ${ice}
        <span class="set__shine" aria-hidden="true"></span>
        <ul class="set__sparks" aria-hidden="true"><li></li><li></li><li></li><li></li></ul>
      </div>
    </div>`;
  }

  function chipsHTML(slide) {
    const parts = setParts(slide.name);
    if (!parts) return '';
    return `<ul class="slide__chips">
      <li>มิกเซอร์ ${parts.mixers} ขวด</li>
      <li>น้ำแข็ง ${parts.ice} ถัง</li>
    </ul>`;
  }

  function slideHTML(slide, index) {
    const kind = pageKind(slide);
    const price =
      slide.price === null || slide.price === undefined
        ? '<p class="slide__price"><span class="slide__price-num">สอบถามราคา</span></p>'
        : `<p class="slide__price"><span class="slide__price-num">${THB(slide.price)}</span><small>เซ็ต</small></p>`;
    const total = state.promoSlides.length || 1;
    /* the bottle leads the headline and the extras sit under it, so a long
       "+ มิกเซอร์ 10 ขวด + น้ำแข็ง 1 ถัง" no longer wraps into noise */
    const parts = setParts(slide.name);
    const nameHTML = parts
      ? `<span class="slide__name-bottle">${escapeHTML(parts.bottle)}</span><span class="slide__name-rest">+ มิกเซอร์ ${parts.mixers} ขวด + น้ำแข็ง ${parts.ice} ถัง</span>`
      : `<span class="slide__name-bottle">${escapeHTML(slide.name)}</span>`;
    return `<article class="slide slide--${kind}" role="group" aria-roledescription="สไลด์" aria-label="${index + 1} จาก ${total}">
      <div class="slide__text">
        <span class="slide__tag">${state.mode === 'before_midnight' ? 'ก่อนเที่ยงคืน' : 'หลังเที่ยงคืน'}</span>
        <h3 class="slide__name">${nameHTML}</h3>
        ${price}
        ${chipsHTML(slide)}
      </div>
      ${setHTML(slide, kind)}
    </article>`;
  }

  function renderPromotions() {
    const promo = state.data?.promotions?.[state.mode];
    if (!promo || !el.track) return;

    const sets = [...(promo.sets || []), ...(promo.beer || [])];
    state.promoSlides = sets;
    el.track.innerHTML = sets.map((s, i) => slideHTML(s, i)).join('');
    el.dots.innerHTML = sets
      .map(
        (s, i) =>
          `<button class="slider__dot" type="button" aria-label="หน้า ${i + 1}: ${escapeAttr(s.name)}"></button>`
      )
      .join('');

    if (el.promoLabel) el.promoLabel.textContent = promo.label || '';

    el.track.querySelectorAll('.slide__art').forEach((img) => {
      img.addEventListener('error', () => {
        const box = document.createElement('div');
        box.className = 'slide__icon';
        box.innerHTML = iconMarkup(img.dataset.icon || 'spirit');
        img.replaceWith(box);
      });
    });

    state.slides = Array.from(el.track.children);
    state.slideIndex = 0;
    el.track.scrollTo({ top: 0, behavior: 'auto' });
    syncDots();
    activateSlide(0, state.introDone);
    if (state.introDone) startAutoplay();
    setModeChrome();
  }

  /* ── Motion graphics ───────────────────────────────────────── */
  function animatePrice(node, value) {
    if (reduceMotion || typeof value !== 'number') return;
    const duration = 650;
    const start = performance.now();
    node.textContent = THB(0);
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      node.textContent = THB(Math.round(value * eased));
      if (p < 1) requestAnimationFrame(tick);
      else node.textContent = THB(value);
    };
    requestAnimationFrame(tick);
  }

  function activateSlide(index, withCount = true, replay = false) {
    const slide = state.slides[index];
    state.slides.forEach((s, i) => {
      if (i === index) return;
      s.classList.remove('is-active');
    });
    if (!slide) return;
    if (replay && slide.classList.contains('is-active')) {
      slide.classList.remove('is-active');
      void slide.offsetWidth; // restart the CSS entrance animations
    }
    slide.classList.add('is-active');

    const num = slide.querySelector('.slide__price-num');
    const price = state.promoSlides[index]?.price;
    if (num && typeof price === 'number') {
      if (withCount) animatePrice(num, price);
      else num.textContent = THB(price);
    }
    syncArt3D();
  }

  /* ── Optional three.js art (drag / tilt) ───────────────────── */
  async function setupArt3D() {
    if (!ART3D_ENABLED || art3dStarted || reduceMotion) return;
    art3dStarted = true;
    try {
      const mod = await import('./art3d.js');
      await mod.init();
      art3d = mod;
      syncArt3D();
    } catch (err) {
      art3d = null; // keep the plain <img> art
      console.warn('[art3d] disabled:', err && err.message);
    }
  }

  function syncArt3D() {
    if (!art3d) return;
    const slide = state.slides[state.slideIndex];
    const stage = slide?.querySelector('.slide__stage');
    const img = slide?.querySelector('.slide__art');
    if (stage && img) art3d.show(stage, img.getAttribute('src'));
    else art3d.clear();
  }

  function setModeChrome() {
    const before = state.mode === 'before_midnight';
    // the switch exists twice: on the promo deck and in the menu list
    [
      [el.tabBefore, el.tabAfter],
      [el.tabBeforeMenu, el.tabAfterMenu],
    ].forEach(([on, off]) => {
      if (!on || !off) return;
      on.classList.toggle('is-active', before);
      off.classList.toggle('is-active', !before);
      on.setAttribute('aria-pressed', String(before));
      off.setAttribute('aria-pressed', String(!before));
    });
  }

  function setMode(mode) {
    if (state.mode === mode || !state.data) return;
    state.mode = mode;
    saveMode(mode);
    renderPromotions();
    // the menu list carries the promo sets, so it has to follow the switch
    if (state.data) {
      renderMenu();
      if (state.query) applySearch();
    }
    toast(mode === 'before_midnight' ? 'แสดงโปรโมชันก่อนเที่ยงคืน' : 'แสดงโปรโมชันหลังเที่ยงคืน');
  }

  function syncDots() {
    Array.from(el.dots.children).forEach((dot, i) => {
      const active = i === state.slideIndex;
      dot.classList.toggle('is-active', active);
      if (active) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
  }

  function goToSlide(index, userInitiated = true) {
    const count = state.slides.length;
    if (!count) return;
    state.slideIndex = ((index % count) + count) % count;
    state.scrollLockUntil = Date.now() + (reduceMotion ? 60 : 480);
    const target = state.slides[state.slideIndex];
    const offset = target.getBoundingClientRect().top - el.track.getBoundingClientRect().top + el.track.scrollTop;
    el.track.scrollTo({ top: offset, behavior: reduceMotion ? 'auto' : 'smooth' });
    syncDots();
    activateSlide(state.slideIndex, userInitiated);
    if (userInitiated) pauseAutoplay(6000);
  }

  function onSliderScroll() {
    if (Date.now() < state.scrollLockUntil) return;
    const top = el.track.scrollTop;
    let best = 0;
    let bestDelta = Infinity;
    state.slides.forEach((s, i) => {
      const delta = Math.abs(
        s.getBoundingClientRect().top - el.track.getBoundingClientRect().top + el.track.scrollTop - top
      );
      if (delta < bestDelta) {
        bestDelta = delta;
        best = i;
      }
    });
    if (best !== state.slideIndex) {
      state.slideIndex = best;
      syncDots();
      activateSlide(best, true);
    }
  }

  function startAutoplay() {
    stopAutoplay();
    if (reduceMotion || state.deckVisible === false || state.slides.length < 2) return;
    state.autoplayId = setInterval(() => {
      if (document.hidden || Date.now() < state.pausedUntil) return;
      goToSlide(state.slideIndex + 1, false);
    }, AUTOPLAY_MS);
  }

  function stopAutoplay() {
    if (state.autoplayId) clearInterval(state.autoplayId);
    state.autoplayId = null;
  }

  function pauseAutoplay(ms = 5000) {
    state.pausedUntil = Date.now() + ms;
  }

  /* the deck must not flip pages while it is scrolled out of view */
  function watchDeck() {
    if (!el.deck || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        state.deckVisible = entry.isIntersecting && entry.intersectionRatio >= 0.35;
        if (state.deckVisible && state.introDone) startAutoplay();
        else stopAutoplay();
      },
      { threshold: [0, 0.35, 0.7] }
    );
    io.observe(el.deck);
  }

  function wireSlider() {
    if (!el.track) return;
    let raf = 0;
    el.track.addEventListener(
      'scroll',
      () => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(onSliderScroll);
      },
      { passive: true }
    );
    ['pointerdown', 'touchstart', 'mouseenter'].forEach((evt) =>
      el.track.addEventListener(evt, () => pauseAutoplay(7000), { passive: true })
    );
    ['pointerup', 'touchend', 'mouseleave'].forEach((evt) =>
      el.track.addEventListener(evt, () => pauseAutoplay(3500), { passive: true })
    );
    el.track.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        goToSlide(state.slideIndex + 1);
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        goToSlide(state.slideIndex - 1);
      }
    });
    el.prev?.addEventListener('click', () => goToSlide(state.slideIndex - 1));
    el.next?.addEventListener('click', () => goToSlide(state.slideIndex + 1));
    el.dots?.addEventListener('click', (e) => {
      const dot = e.target.closest('.slider__dot');
      if (!dot) return;
      goToSlide(Array.from(el.dots.children).indexOf(dot));
    });
    el.tabBefore?.addEventListener('click', () => setMode('before_midnight'));
    el.tabAfter?.addEventListener('click', () => setMode('after_midnight'));
    el.tabBeforeMenu?.addEventListener('click', () => setMode('before_midnight'));
    el.tabAfterMenu?.addEventListener('click', () => setMode('after_midnight'));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) goToSlide(state.slideIndex, false);
    });
  }

  /* Default period by Bangkok time: 18:00–05:59 → the matching promo. */
  function detectMode() {
    try {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Bangkok',
        hour: '2-digit',
        hour12: false,
      }).formatToParts(new Date());
      const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 20);
      return hour >= 18 || hour < 6 ? (hour >= 18 ? 'before_midnight' : 'after_midnight') : 'before_midnight';
    } catch (_) {
      return new Date().getHours() >= 18 ? 'before_midnight' : 'after_midnight';
    }
  }

  /* ── Menu ──────────────────────────────────────────────────── */
  function escapeHTML(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function escapeAttr(str) {
    return escapeHTML(str);
  }

  function cardHTML(item, cat) {
    const src = item.image ? './' + item.image.replace(/^\.\//, '') : null;
    /* a promo set is sold as a whole: the list tile shows the same composition
       as the deck (hero bottle + ten mixers + ice bucket), not one bottle */
    const combo = setParts(item.name) ? 'spirit' : null;
    const media = combo
      ? `<div class="card__combo">${setHTML(item, combo)}</div>`
      : src
        ? `<img class="card__img" src="${src}" alt="${escapeAttr(item.name)}" width="320" height="320" loading="lazy" decoding="async" data-icon="${cat.id}" />`
        : `<span class="card__icon">${iconMarkup(cat.id)}</span>`;
    const price =
      item.price === null || item.price === undefined
        ? '<p class="card__price card__price--ask">สอบถามราคา</p>'
        : `<p class="card__price">${THB(item.price)}</p>`;
    /* the tile itself is the tap target: one tap counts the item, and the red
       badge on the same tile takes one back. Price rides on the hit button so
       the order total never has to look items up again. */
    const priceAttr = item.price === null || item.price === undefined ? '' : String(item.price);
    const nameAttr = escapeAttr(item.name);
    /* a spirit set ships with ten mixers, so its tile opens the mixer chooser
       first instead of counting the set blindly */
    const isSet = combo === 'spirit';
    const hitLabel = isSet ? `เลือกมิกเซอร์สำหรับ ${nameAttr}` : `เพิ่ม ${nameAttr} ลงรายการ`;
    return `<article class="card reveal" data-name="${escapeAttr(item.name.toLowerCase())}">
      <div class="card__media${combo ? ' card__media--set' : ''}">
        ${media}
        <button class="card__hit" type="button" data-append="${nameAttr}" data-price="${priceAttr}" data-set="${isSet ? 'spirit' : ''}" aria-label="${hitLabel}"></button>
        <button class="card__qty" type="button" data-take="${nameAttr}" aria-label="ลดจำนวน ${nameAttr}" hidden>0</button>
      </div>
      <h3 class="card__name">${escapeHTML(item.name)}</h3>
      ${price}
    </article>`;
  }

  /* promo sets are menu items too: they lead the list and get their own tab */
  function promoCat() {
    return {
      id: 'promo',
      name: 'โปรโมชัน · ' + (state.mode === 'before_midnight' ? 'ก่อนเที่ยงคืน' : 'หลังเที่ยงคืน'),
      icon: '🔥',
    };
  }

  function promoList() {
    const promo = state.data?.promotions?.[state.mode];
    return [...(promo?.sets || []), ...(promo?.beer || [])];
  }

  function blockHTML(cat, list) {
    return `<section class="cat-block" id="cat-${cat.id}" aria-labelledby="cat-${cat.id}-title">
          <div class="cat-block__head">
            <h3 class="cat-block__title" id="cat-${cat.id}-title">
              <span aria-hidden="true">${cat.icon || ''}</span> ${escapeHTML(cat.name)}
            </h3>
            <span class="cat-block__count">${list.length} รายการ</span>
            <span class="cat-block__rule" aria-hidden="true"></span>
          </div>
          <div class="grid">${list.map((i) => cardHTML(i, cat)).join('')}</div>
        </section>`;
  }

  function renderMenu() {
    const { categories = [], items = [] } = state.data;
    const promos = promoList();
    const promo = promos.length ? promoCat() : null;
    el.tabs.innerHTML = [promo, ...categories]
      .filter(Boolean)
      .map(
        (c) =>
          `<button class="tab" type="button" data-cat="${c.id}" aria-controls="cat-${c.id}">
            <span aria-hidden="true">${c.icon || ''}</span>${escapeHTML(c.name)}
          </button>`
      )
      .join('');

    el.body.innerHTML =
      (promo ? blockHTML(promo, promos) : '') +
      categories
        .map((c) => {
          const list = items.filter((i) => i.cat === c.id);
          return list.length ? blockHTML(c, list) : '';
        })
        .join('');

    el.body.querySelectorAll('.card__img').forEach((img) => {
      img.addEventListener('error', () => {
        const span = document.createElement('span');
        span.className = 'card__icon';
        span.innerHTML = iconMarkup(img.dataset.icon);
        img.replaceWith(span);
      });
    });

    state.cards = Array.from(el.body.querySelectorAll('.card'));
    state.blocks = Array.from(el.body.querySelectorAll('.cat-block'));
    if (state.blocks[0]) setActiveTab(state.blocks[0].id.replace('cat-', ''));

    const total = items.length + promos.length;
    el.status.textContent = `${total} รายการ · เวอร์ชัน ${state.data.version || '1.0.0'}`;
    el.footerMeta.textContent = `เมนูเวอร์ชัน ${state.data.version || '1.0.0'}`;

    observeReveal();
    /* the cards were just rebuilt, so put the red counts back on them */
    paintOrder();
  }

  function wireTabs() {
    el.tabs.addEventListener('click', (e) => {
      const tab = e.target.closest('.tab');
      if (!tab) return;
      const block = document.getElementById('cat-' + tab.dataset.cat);
      if (!block) return;
      const top = block.getBoundingClientRect().top + window.scrollY - (el.tabs.offsetHeight + 10);
      window.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
      setActiveTab(tab.dataset.cat);
    });
  }

  function setActiveTab(id) {
    state.activeCat = id;
    el.tabs.querySelectorAll('.tab').forEach((tab) => {
      const active = tab.dataset.cat === id;
      tab.classList.toggle('is-active', active);
      if (active) {
        // scroll the tab strip horizontally only — scrollIntoView would drag the page
        // down to the menu on load and steal the promo's first screen
        el.tabs.scrollTo({
          left: tab.offsetLeft - el.tabs.clientWidth / 2 + tab.offsetWidth / 2,
          behavior: reduceMotion ? 'auto' : 'smooth',
        });
      }
    });
  }

  function wireScrollSpy() {
    let raf = 0;
    const update = () => {
      const line = el.tabs.offsetHeight + 20;
      let current = state.blocks[0];
      state.blocks.forEach((block) => {
        if (block.getBoundingClientRect().top - line <= 0) current = block;
      });
      if (current && current.id.replace('cat-', '') !== state.activeCat) {
        setActiveTab(current.id.replace('cat-', ''));
      }
    };
    window.addEventListener(
      'scroll',
      () => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(update);
      },
      { passive: true }
    );
    if (state.blocks[0]) setActiveTab(state.blocks[0].id.replace('cat-', ''));
  }

  function observeReveal() {
    if (reduceMotion) {
      state.cards.forEach((c) => c.classList.add('is-in'));
      return;
    }
    let raf = 0;
    const pass = () => {
      raf = 0;
      const limit = window.innerHeight + 80;
      state.cards.forEach((card) => {
        if (card.classList.contains('is-in')) return;
        if (card.getBoundingClientRect().top < limit) card.classList.add('is-in');
      });
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(pass);
    };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    pass();
  }

  function applySearch() {
    if (!state.data) return;
    const q = state.query.trim().toLowerCase();
    let shown = 0;
    state.cards.forEach((card) => {
      const match = !q || card.dataset.name.includes(q);
      card.hidden = !match;
      if (match) shown++;
    });
    state.blocks.forEach((block) => {
      block.hidden = !block.querySelector('.card:not([hidden])');
    });
    el.searchClear.hidden = !q;
    el.status.textContent = q
      ? `พบ ${shown} รายการ จากคำค้น “${state.query.trim()}”`
      : `${state.data.items.length + promoList().length} รายการ · เวอร์ชัน ${state.data.version}`;
  }

  function wireSearch() {
    let timer = null;
    el.search.addEventListener('input', (e) => {
      clearTimeout(timer);
      const value = e.target.value;
      timer = setTimeout(() => {
        state.query = value;
        applySearch();
      }, 120);
    });
    el.searchClear.addEventListener('click', () => {
      el.search.value = '';
      state.query = '';
      applySearch();
      el.search.focus();
    });
  }

  /* ── Order: tap tiles to count them and add up the price ───── */
  /* name → { price, qty }; a null price means "ask the staff", which is counted
     in the item tally but kept out of the money total */
  /* keyed by the line label, so one set can sit in the order twice with
     different mixers ("... · โค้ก" and "... · สไปรท์") */
  const order = new Map();

  function readPrice(value) {
    return value === '' || value === undefined ? null : Number(value);
  }

  function addToOrder(name, priceValue, label) {
    const key = label || name;
    const row = order.get(key) || { name, price: readPrice(priceValue), qty: 0 };
    row.qty += 1;
    order.set(key, row);
    paintOrder(name);
  }

  function takeFromOrder(key) {
    const row = order.get(key);
    if (!row) return;
    row.qty -= 1;
    if (row.qty > 0) order.set(key, row);
    else order.delete(key);
    paintOrder(row.name);
  }

  /* the badge on a card speaks for the item, so it takes one off the most
     recently added line of that item */
  function takeFromOrderItem(itemName) {
    const keys = [...order.keys()];
    for (let i = keys.length - 1; i >= 0; i -= 1) {
      if (order.get(keys[i]).name === itemName) {
        takeFromOrder(keys[i]);
        return;
      }
    }
  }

  /* the product itself hops as well, so the tap feels physical on the tile */
  function bounceTile(media) {
    if (!media || reduceMotion) return;
    media.classList.remove('is-bounce');
    void media.offsetWidth; /* restart the keyframes on a repeat tap */
    media.classList.add('is-bounce');
    clearTimeout(media._bounceTimer);
    media._bounceTimer = setTimeout(() => media.classList.remove('is-bounce'), 470);
  }

  /* the red badge pops every time it changes, so a tap reads as "it counted" */
  function bumpBadge(badge) {
    badge.classList.remove('is-bump');
    void badge.offsetWidth; /* restart the keyframes on a repeat tap */
    badge.classList.add('is-bump');
  }

  function paintOrder(bumpedName) {
    let qty = 0;
    let total = 0;
    let asking = 0;
    order.forEach((row) => {
      qty += row.qty;
      if (row.price === null) asking += row.qty;
      else total += row.price * row.qty;
    });

    /* one card can hold several lines (a set with different mixers), so the
       badge shows the sum for that item */
    const perItem = new Map();
    order.forEach((row) => perItem.set(row.name, (perItem.get(row.name) || 0) + row.qty));

    el.body.querySelectorAll('.card__qty').forEach((badge) => {
      const name = badge.dataset.take;
      const count = perItem.get(name) || 0;
      const card = badge.closest('.card');
      if (!count) {
        badge.hidden = true;
        badge.textContent = '0';
        if (card) card.classList.remove('is-picked');
        return;
      }
      badge.hidden = false;
      badge.textContent = String(count);
      badge.setAttribute('aria-label', `ลดจำนวน ${name} (ตอนนี้ ${count})`);
      if (card) card.classList.add('is-picked');
      if (name === bumpedName) bumpBadge(badge);
    });

    el.orderCount.textContent = String(qty);
    el.orderTotal.textContent = THB(total);
    el.orderNote.hidden = asking === 0;
    el.orderNote.textContent = asking ? `+${asking} รายการสอบถามราคา` : '';
    el.orderBar.hidden = qty === 0;
    document.body.classList.toggle('has-order', qty > 0);
    renderSheet();
  }

  function wireOrder() {
    el.body.addEventListener('click', (e) => {
      const add = e.target.closest('.card__hit');
      if (add) {
        if (add.dataset.set) {
          openMixer(add);
          return;
        }
        addToOrder(add.dataset.append, add.dataset.price);
        bounceTile(add.closest('.card__media'));
        return;
      }
      const take = e.target.closest('.card__qty');
      if (take) takeFromOrderItem(take.dataset.take);
    });

    el.orderClear.addEventListener('click', () => {
      order.clear();
      paintOrder();
      closeSheet();
    });
  }

  /* ── Mixer chooser: the set ships ten bottles, mixed however the guest likes ── */
  const MIXER_SET_SIZE = 10;
  /* soda-water.webp is the plain water bottle, so it belongs to น้ำ. โซดา points
     at images/soda.webp: drop that file in and the real bottle shows up on its
     own, otherwise the tile falls back to the bottle icon below */
  const MIXER_OPTIONS = [
    { name: 'โค้ก', img: './images/coke.webp' },
    { name: 'น้ำ', img: './images/soda-water.webp' },
    { name: 'โซดา', img: './images/soda.webp', icon: 'spirit' },
    { name: 'สไปรท์', img: './images/sprite.webp' },
  ];
  const mixerPick = new Map();
  let pendingSet = null;

  function mixerTotal() {
    let total = 0;
    mixerPick.forEach((n) => {
      total += n;
    });
    return total;
  }

  function renderMixer() {
    const total = mixerTotal();
    el.mixerGrid.querySelectorAll('.mixer__tile').forEach((tile) => {
      const name = tile.dataset.mixer;
      const count = mixerPick.get(name) || 0;
      const num = tile.querySelector('.mixer__count');
      num.textContent = String(count);
      tile.classList.toggle('is-picked', count > 0);
      const minus = tile.querySelector('.mixer__minus');
      if (minus) minus.disabled = count === 0;
      const plus = tile.querySelector('.mixer__plus');
      if (plus) plus.disabled = total >= MIXER_SET_SIZE;
      tile.querySelector('.mixer__count').setAttribute('aria-label', `${name} ${count} ขวด`);
    });
    el.mixerProgress.textContent = `เลือกแล้ว ${total} / ${MIXER_SET_SIZE} ขวด`;
    el.mixerProgress.classList.toggle('is-full', total === MIXER_SET_SIZE);
    el.mixerConfirm.disabled = total !== MIXER_SET_SIZE;
    el.mixerConfirm.textContent = total === MIXER_SET_SIZE ? 'เพิ่มลงรายการ' : `เหลือ ${MIXER_SET_SIZE - total} ขวด`;
  }

  function openMixer(hit) {
    pendingSet = { name: hit.dataset.append, price: hit.dataset.price, media: hit.closest('.card__media') };
    el.mixerSetName.textContent = pendingSet.name;
    mixerPick.clear();
    MIXER_OPTIONS.forEach((option) => mixerPick.set(option.name, 0));

    if (!el.mixerGrid.children.length) {
      el.mixerGrid.innerHTML = MIXER_OPTIONS.map((option) => {
        const art = option.img
          ? `<img class="mixer__thumb" src="${option.img}" alt="" width="52" height="52" loading="lazy" decoding="async" data-icon="${option.icon || 'other'}" />`
          : `<span class="mixer__thumb mixer__thumb--icon">${iconMarkup(option.icon)}</span>`;
        /* the whole tile counts as one bottle: the art itself is the button,
           and the tile behind it takes the same tap */
        const thumb = `<button class="mixer__thumb-btn" type="button" data-plus="${escapeAttr(option.name)}" aria-label="เพิ่ม ${escapeAttr(option.name)} 1 ขวด">${art}</button>`;
        return `<div class="mixer__tile" data-mixer="${escapeAttr(option.name)}" data-plus="${escapeAttr(option.name)}">
              ${thumb}
              <span class="mixer__label">${escapeHTML(option.name)}</span>
              <span class="mixer__row">
                <button class="mixer__minus" type="button" data-minus="${escapeAttr(option.name)}" aria-label="ลด ${escapeAttr(option.name)}">−</button>
                <b class="mixer__count" aria-live="off">0</b>
                <button class="mixer__plus" type="button" data-plus="${escapeAttr(option.name)}" aria-label="เพิ่ม ${escapeAttr(option.name)}">+</button>
              </span>
            </div>`;
      }).join('');
    }

    /* a mixer photo that is not in ./images yet (e.g. soda.webp) leaves no
       broken tile: the same slot shows its bottle icon instead */
    el.mixerGrid.querySelectorAll('img.mixer__thumb').forEach((img) => {
      img.addEventListener(
        'error',
        () => {
          const span = document.createElement('span');
          span.className = 'mixer__thumb mixer__thumb--icon';
          span.innerHTML = iconMarkup(img.dataset.icon || 'other');
          img.replaceWith(span);
        },
        { once: true }
      );
    });

    renderMixer();
    el.mixerSheet.hidden = false;
    document.body.classList.add('has-sheet');
    const first = el.mixerGrid.querySelector('.mixer__plus');
    if (first) first.focus();
  }

  function closeMixer() {
    if (el.mixerSheet.hidden) return;
    el.mixerSheet.hidden = true;
    pendingSet = null;
    if (el.orderSheet.hidden) document.body.classList.remove('has-sheet');
  }

  /* "305 · โค้ก×7 + โซดา×3" — only the kinds that were actually picked */
  function mixerLabel(setName) {
    const parts = MIXER_OPTIONS.filter((option) => (mixerPick.get(option.name) || 0) > 0).map(
      (option) => `${option.name}×${mixerPick.get(option.name)}`
    );
    return `${setName} · ${parts.join(' + ')}`;
  }

  function wireMixer() {
    el.mixerScrim.addEventListener('click', closeMixer);
    el.mixerX.addEventListener('click', closeMixer);

    el.mixerGrid.addEventListener('click', (e) => {
      if (!pendingSet) return;
      /* minus first: it sits inside a tile that also counts as a "plus" */
      const minus = e.target.closest('[data-minus]');
      if (minus) {
        const name = minus.dataset.minus;
        mixerPick.set(name, Math.max(0, (mixerPick.get(name) || 0) - 1));
        renderMixer();
        return;
      }
      const plus = e.target.closest('[data-plus]');
      if (!plus) return;
      const name = plus.dataset.plus;
      if (mixerTotal() >= MIXER_SET_SIZE) return;
      mixerPick.set(name, (mixerPick.get(name) || 0) + 1);
      renderMixer();
    });

    el.mixerConfirm.addEventListener('click', () => {
      if (!pendingSet || mixerTotal() !== MIXER_SET_SIZE) return;
      const set = pendingSet;
      const label = mixerLabel(set.name);
      closeMixer();
      addToOrder(set.name, set.price, label);
      bounceTile(set.media);
    });
  }

  /* ── Summary sheet: the picked list, the total, and the bill split ── */
  let splitPeople = 2;
  let sheetReturnFocus = null;

  function renderSheet() {
    if (!el.orderList) return;
    let qty = 0;
    let total = 0;
    let asking = 0;
    order.forEach((row) => {
      qty += row.qty;
      if (row.price === null) asking += row.qty;
      else total += row.price * row.qty;
    });

    el.orderList.innerHTML = [...order.entries()]
      .map(([label, row]) => {
        const key = escapeAttr(label);
        const item = escapeAttr(row.name);
        const line = row.price === null ? 'สอบถาม' : THB(row.price * row.qty);
        return `<li class="sheet__row">
            <span class="sheet__name">${escapeHTML(label)}</span>
            <span class="sheet__step">
              <button class="sheet__btn" type="button" data-take="${key}" aria-label="ลด ${key}">−</button>
              <b class="sheet__qty">${row.qty}</b>
              <button class="sheet__btn" type="button" data-append="${item}" data-label="${key}" data-price="${row.price === null ? '' : row.price}" aria-label="เพิ่ม ${key}">+</button>
            </span>
            <span class="sheet__line">${line}</span>
          </li>`;
      })
      .join('');

    el.orderEmpty.hidden = qty > 0;
    el.sheetTotal.textContent = THB(total);
    el.splitPeople.textContent = String(splitPeople);
    /* split to the baht, rounded up, so nobody is a satang short */
    el.splitEach.textContent = qty ? `คนละ ${THB(Math.ceil(total / splitPeople))}` : 'คนละ ฿0';
    el.sheetNote.hidden = asking === 0;
    el.sheetNote.textContent = asking ? `มี ${asking} รายการที่ต้องสอบถามราคากับพนักงาน — ยังไม่รวมในยอดนี้` : '';
    el.splitMinus.disabled = splitPeople <= 1;
    el.splitPlus.disabled = splitPeople >= 20;
  }

  function openSheet() {
    sheetReturnFocus = document.activeElement;
    renderSheet();
    el.orderSheet.hidden = false;
    document.body.classList.add('has-sheet');
    el.orderSheetX.focus();
  }

  function closeSheet() {
    if (el.orderSheet.hidden) return;
    el.orderSheet.hidden = true;
    document.body.classList.remove('has-sheet');
    if (sheetReturnFocus && typeof sheetReturnFocus.focus === 'function') sheetReturnFocus.focus();
  }

  function wireSheet() {
    el.orderOpen.addEventListener('click', openSheet);
    el.orderSheetX.addEventListener('click', closeSheet);
    el.orderScrim.addEventListener('click', closeSheet);
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!el.mixerSheet.hidden) closeMixer();
      else if (!el.orderSheet.hidden) closeSheet();
    });
    el.orderList.addEventListener('click', (e) => {
      const add = e.target.closest('[data-append]');
      if (add) {
        addToOrder(add.dataset.append, add.dataset.price, add.dataset.label);
        return;
      }
      const take = e.target.closest('[data-take]');
      if (take) takeFromOrder(take.dataset.take);
    });
    el.splitMinus.addEventListener('click', () => {
      splitPeople = Math.max(1, splitPeople - 1);
      renderSheet();
    });
    el.splitPlus.addEventListener('click', () => {
      splitPeople = Math.min(20, splitPeople + 1);
      renderSheet();
    });
  }

  /* ── Chrome: back-to-top ───────────────────────────────────── */
  function wireToTop() {
    let raf = 0;
    window.addEventListener(
      'scroll',
      () => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          el.toTop.hidden = window.scrollY < 420;
        });
      },
      { passive: true }
    );
    el.toTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  }

  function showError(message, retry) {
    el.error.hidden = false;
    el.error.innerHTML = '';
    const p = document.createElement('span');
    p.textContent = message;
    el.error.append(p);
    if (retry) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-retry';
      btn.textContent = 'ลองอีกครั้ง';
      btn.addEventListener('click', () => {
        el.error.hidden = true;
        boot();
      });
      el.error.append(btn);
    }
  }

  async function boot() {
    try {
      const data = await loadMenu();
      state.data = data;
      applyShop(data.shop || {});
      state.mode = readSavedMode() || detectMode();
      renderPromotions();
      renderMenu();
      el.error.hidden = true;
      setupArt3D();
    } catch (err) {
      console.error('[menu] load failed:', err);
      el.status.textContent = '';
      showError('โหลดเมนูไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อหรือรีเฟรชหน้านี้อีกครั้ง', true);
    }
  }

  /* ── Init ──────────────────────────────────────────────────── */
  startIntro();
  wireTheme();
  watchDeck();
  wireSlider();
  wireSearch();
  wireOrder();
  wireMixer();
  wireSheet();
  wireToTop();
  wireTabs();
  wireScrollSpy();
  boot();
})();
