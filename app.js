/* SOD! signature — menu site logic
   Static, no build step. All content comes from ./data/menu.json */

(() => {
  'use strict';

  // Bump together with "version" in data/menu.json so browsers drop the cache.
  const ASSET_VERSION = '1.0.41';
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
    reserveOpen: $('reserveOpen'),
    reserveSheet: $('reserveSheet'),
    reserveScrim: $('reserveScrim'),
    reserveX: $('reserveX'),
    reserveHint: $('reserveHint'),
    reserveLast: $('reserveLast'),
    reserveForm: $('reserveForm'),
    reserveAuto: $('reserveAuto'),
    reservePay: $('reservePay'),
    reservePayAmount: $('reservePayAmount'),
    reservePayHow: $('reservePayHow'),
    reservePayCopy: $('reservePayCopy'),
    reservePayLink: $('reservePayLink'),
    reserveDoneTitle: $('reserveDoneTitle'),
    reserveSlipDrop: $('reserveSlipDrop'),
    reserveSlipFile: $('reserveSlipFile'),
    reserveSlipText: $('reserveSlipText'),
    reserveSlipPreview: $('reserveSlipPreview'),
    reserveSlipImg: $('reserveSlipImg'),
    reserveSlipSend: $('reserveSlipSend'),
    reserveSlipMsg: $('reserveSlipMsg'),
    reserveHold: $('reserveHold'),
    reserveName: $('rsvName'),
    reservePhone: $('rsvPhone'),
    reserveDate: $('rsvDate'),
    reserveTime: $('rsvTime'),
    reserveParty: $('rsvParty'),
    reserveNote: $('rsvNote'),
    reserveErr: $('reserveErr'),
    reserveSubmit: $('reserveSubmit'),
    reserveDone: $('reserveDone'),
    reserveCode: $('reserveCode'),
    reserveSummary: $('reserveSummary'),
    reserveStatus: $('reserveStatus'),
    reserveShare: $('reserveShare'),
    reserveCall: $('reserveCall'),
    reserveCopy: $('reserveCopy'),
    reserveAgain: $('reserveAgain'),
    planBox: $('planBox'),
    planCanvas: $('planCanvas'),
    planScroll: $('planScroll'),
    planStatus: $('planStatus'),
    planFee: $('planFee'),
    planPick: $('planPick'),
    planFit: $('planFit'),
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
    reserve: null,
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
    state.reserve = shop.reserve || null;
    syncReserveUI();
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

  /* ── Table reservation ─────────────────────────────────────────
     The page is static, so a booking can travel three ways, best first:
     1. POST to shop.reserve.webhook (Apps Script, Formspree, Supabase fn, …)
     2. a prefilled LINE message the guest sends to the shop
     3. a phone call, when the shop publishes a number
     The booking is always kept on the device as well, so the guest can show
     the code at the door even before the shop connects a webhook. */
  const RESERVE_KEY = 'sod-reserve-last';

  const RESERVE_DEFAULTS = {
    enabled: true,
    open_time: '17:00',
    close_time: '02:00',
    max_party: 20,
    max_days: 30,
    webhook: '',
    line_url: '',
    phone: '',
    hint: 'กรอกข้อมูลให้ครบ แล้วรอร้านยืนยันอีกครั้ง',
    plan: null,
  };

  let reserveCurrent = null;
  let reserveReturnFocus = null;
  let pickedTables = [];
  let planBusy = new Map();
  let planLocks = new Map();
  let planBuilt = false;
  let planIndex = new Map();
  /* the shop can close a day: a daily cut-off time, or an event that locks it */
  let planClosed = { closed: false, reason: '', closeTime: '', event: null };
  let planClosedTimer = 0;
  /* ค่าบริการจองของวันที่เลือก (ศุกร์/เสาร์/อีเว้น) — มาจาก ?action=busy */
  let planFee = null;

  /* ยอดค่าบริการของวัน/จำนวนคนที่เลือกไว้ (ตอนยังไม่กดจอง) */
  function reserveDueTotal() {
    if (!planFee || !planFee.needed) return 0;
    const amount = Number(planFee.amount) || 0;
    if (amount <= 0) return 0;
    const party = Number(el.reserveParty && el.reserveParty.value) || 1;
    if (planFee.per === 'person') return amount * party;
    if (planFee.per === 'table') return amount * Math.max(1, pickedTables.length);
    return amount;
  }

  /* ปุ่มหลักของฟอร์มจอง: มีค่าบริการ = “ชำระเงิน ฿X”, ไม่มี = “ยืนยันการจอง” */
  function reserveSubmitLabel() {
    const due = reserveDueTotal();
    return due > 0 ? `ชำระเงิน ฿${due.toLocaleString('th-TH')}` : 'ยืนยันการจอง';
  }

  function updateReserveSubmit() {
    if (!el.reserveSubmit || el.reserveSubmit.disabled) return;
    el.reserveSubmit.textContent = reserveSubmitLabel();
  }

  function reserveConfig() {
    const raw = (state.data && state.data.shop && state.data.shop.reserve) || {};
    return Object.assign({}, RESERVE_DEFAULTS, raw);
  }

  const pad2 = (n) => String(n).padStart(2, '0');
  const isoDate = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

  function hhmmToMin(value) {
    const [h, m] = String(value || '').split(':').map(Number);
    return Number.isFinite(h) ? h * 60 + (Number.isFinite(m) ? m : 0) : NaN;
  }

  /* service hours may wrap past midnight (17:00 → 02:00) */
  function inService(min, open, close) {
    if (!Number.isFinite(min) || !Number.isFinite(open) || !Number.isFinite(close)) return false;
    return open <= close ? min >= open && min <= close : min >= open || min <= close;
  }

  /* first quarter-hour still inside service hours, at least 45 min out */
  function nextBookableTime(cfg) {
    const open = hhmmToMin(cfg.open_time);
    const close = hhmmToMin(cfg.close_time);
    let t = new Date(Date.now() + 45 * 60000);
    t.setSeconds(0, 0);
    t.setMinutes(Math.ceil(t.getMinutes() / 15) * 15);
    for (let i = 0; i < 96 * 3; i += 1) {
      if (inService(t.getHours() * 60 + t.getMinutes(), open, close)) return t;
      t = new Date(t.getTime() + 15 * 60000);
    }
    return new Date(Date.now() + 60 * 60000);
  }

  function makeReserveCode() {
    const stamp = Date.now().toString(36).slice(-3).toUpperCase();
    const rand = Math.random().toString(36).slice(2, 4).toUpperCase();
    return `SOD-${stamp}${rand}`;
  }

  function thaiShortDate(iso) {
    const d = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
  }

  function readReserveRecord() {
    try {
      const rec = JSON.parse(localStorage.getItem(RESERVE_KEY) || 'null');
      return rec && rec.code ? rec : null;
    } catch (_) {
      return null;
    }
  }

  function saveReserveRecord(rec) {
    try {
      localStorage.setItem(RESERVE_KEY, JSON.stringify(rec));
    } catch (_) {
      /* storage blocked — the code on screen still works */
    }
  }

  /* ── Floor plan: the guest taps the table on the shop's own map ───────
     Tables come from shop.reserve.plan in data/menu.json as percentage
     coordinates of the image, so the map can be replaced without touching code.
     Occupied tables are read from the same Apps Script (?action=busy) which
     returns only table + time, never the guest's details. */
  function planConfig() {
    const plan = reserveConfig().plan;
    if (!plan || plan.enabled === false) return null;
    if (!Array.isArray(plan.tables) || !plan.tables.length) return null;
    return plan;
  }

  function planTableLabel(id) {
    const plan = planConfig();
    const hit = plan && plan.tables.find((t) => t.id === id);
    return hit ? hit.label || hit.id : id;
  }

  /* one hotspot may cover a single table or a pair pushed together (A1+A2) */
  function planTableIds(table) {
    if (table && Array.isArray(table.ids) && table.ids.length) return table.ids.map(String);
    return [String((table && table.id) || '')];
  }

  function planBusyAt(table) {
    const ids = planTableIds(table);
    for (let i = 0; i < ids.length; i += 1) {
      const hit = planBusy.get(ids[i].trim().toUpperCase());
      if (hit !== undefined) return hit;
    }
    return null;
  }

  /* a table the shop closed off for that day (today.html → ล็อคโต๊ะ) */
  function planLockAt(table) {
    const ids = planTableIds(table);
    for (let i = 0; i < ids.length; i += 1) {
      const hit = planLocks.get(ids[i].trim().toUpperCase());
      if (hit !== undefined) return hit;
    }
    return null;
  }

  function pickedLabels() {
    return pickedTables.map((id) => planTableLabel(id));
  }

  /* ── วันที่ร้านปิดรับจอง: เลยเวลาปิดจอง หรือวันนั้นมีอีเว้นที่ล็อคไว้ ── */
  const PLAN_WALKIN = 'กรุณา walk-in หรือเลือกวันอื่น';

  function planClosedHeadline() {
    if (planClosed.reason === 'event') {
      const name = planClosed.event && planClosed.event.name;
      return name ? `ปิดจอง · อีเว้น ${name}` : 'ปิดจอง · มีอีเว้น';
    }
    return planClosed.closeTime ? `ปิดรับจองแล้ว (เลย ${planClosed.closeTime} น.)` : 'ปิดรับจองแล้ว';
  }

  /* จองได้อีกครั้งเมื่อวันอีเว้นจบ — ถ้าร้านตั้งเวลาเปิดหลังงาน (เช่น 00:30) ก็นับถึงเวลานั้น */
  function planReopenAt(event) {
    const start = Date.parse(`${event.date}T00:00:00+07:00`);
    if (Number.isNaN(start)) return 0;
    const nextDay = new Date(start + 86400000 + 7 * 3600000).toISOString().slice(0, 10);
    const at = Date.parse(`${nextDay}T${event.open || '00:00'}:00+07:00`);
    return Number.isNaN(at) ? 0 : at;
  }

  /* นับถอยหลังว่า “เปิดให้จองอีกครั้ง” เมื่อไร แบบเรียลไทม์ (เดินทุกวินาที) */
  function planClosedCountdown() {
    const event = planClosed.event;
    if (planClosed.reason !== 'event' || !event || !event.date) return PLAN_WALKIN;
    const openLine = event.open ? ` · ร้านเปิด ${event.open} น.` : '';
    const target = planReopenAt(event);
    if (!target) return `${PLAN_WALKIN}${openLine}`;
    const left = target - Date.now();
    if (left <= 0) return `เปิดให้จองแล้ว${openLine}`;
    const mins = Math.floor(left / 60000);
    const days = Math.floor(mins / 1440);
    const hours = Math.floor((mins % 1440) / 60);
    const minutes = mins % 60;
    const parts = [];
    if (days) parts.push(`${days} วัน`);
    parts.push(`${hours} ชั่วโมง`);
    if (!days) parts.push(`${minutes} นาที`);
    return `เปิดให้จองในอีก ${parts.join(' ')}${openLine}`;
  }

  /* บอกค่าบริการก่อนกดจอง — เฉพาะศุกร์/เสาร์/วันอีเว้น */
  function renderPlanFee() {
    if (!el.planFee) return;
    if (!planFee || !planFee.needed || !(Number(planFee.amount) > 0)) {
      el.planFee.hidden = true;
      el.planFee.textContent = '';
      return;
    }
    const unit = planFee.per === 'table' ? 'ต่อโต๊ะ' : planFee.per === 'booking' ? 'ต่อการจอง' : 'ต่อคน';
    /* เลือกหลายโต๊ะ → บอกยอดรวมทันที ไม่ต้องรอกดจอง */
    const picked = planFee.per === 'table' && pickedTables.length > 1
      ? ` · ${pickedTables.length} โต๊ะ รวม ฿${reserveDueTotal().toLocaleString('th-TH')}`
      : '';
    el.planFee.hidden = false;
    el.planFee.textContent =
      `${planFee.label || 'วันนี้'} มีค่าบริการจอง ฿${planFee.amount} ${unit}${picked}` +
      (planFee.pay ? ` · โอนที่ ${planFee.pay}` : '') +
      ` · ชำระภายใน ${planFee.holdMinutes || 15} นาทีหลังจอง`;
  }

  function renderPlanClosed() {
    if (planClosedTimer) {
      clearInterval(planClosedTimer);
      planClosedTimer = 0;
    }
    if (el.planCanvas) el.planCanvas.classList.toggle('is-closed', planClosed.closed);
    const box = document.getElementById('planClosed');
    const title = document.getElementById('planClosedTitle');
    const sub = document.getElementById('planClosedSub');
    if (!box) return;
    box.hidden = !planClosed.closed;
    if (!planClosed.closed) return;
    if (title) title.textContent = planClosedHeadline();
    const paint = () => {
      if (planClosed.closed && sub) sub.textContent = planClosedCountdown();
    };
    paint();
    if (planClosed.reason === 'event') planClosedTimer = setInterval(paint, 1000);
  }

  function buildPlan() {
    const plan = planConfig();
    if (!plan || planBuilt || !el.planCanvas) return;
    planIndex = new Map();
    const spots = plan.tables
      .map((t) => {
        const w = Number(t.w) || 5.2;
        const h = Number(t.h) || 5.2;
        planIndex.set(String(t.id), t);
        /* the target copies the drawn table: most of the floor is pentagons,
           the A row and the B pairs are square, so the shape comes from data */
        const shape = t.shape === 'pentagon' ? ' is-shape-pentagon' : '';
        return `<button class="plan__spot${shape}" type="button" data-table="${escapeAttr(t.id)}" aria-label="โต๊ะ ${escapeAttr(t.label || t.id)}" aria-pressed="false" style="left:${Number(t.x)}%;top:${Number(t.y)}%;width:${w}%;height:${h}%"><span class="plan__tag" aria-hidden="true"></span></button>`;
      })
      .join('');
    el.planCanvas.innerHTML = `<img class="plan__img" src="${escapeAttr(plan.image || './images/floorplan.jpg')}" alt="ผังโต๊ะของร้าน" loading="lazy" draggable="false" /><div class="plan__tint" aria-hidden="true"></div>${spots}`;
    planBuilt = true;
  }

  /* one-line status under the map: how many tables are still free and which are taken */
  function planSummary() {
    const plan = planConfig();
    if (!plan) return '';
    if (!reserveConfig().webhook) return 'ยังไม่ได้เชื่อมระบบร้าน — สถานะโต๊ะจะขึ้นเมื่อตั้ง webhook';
    let free = 0;
    const busyList = [];
    const lockList = [];
    plan.tables.forEach((t) => {
      const label = t.label || t.id;
      if (planLockAt(t) !== null) lockList.push(label);
      else if (planBusyAt(t) !== null) busyList.push(label);
      else free += 1;
    });
    const short = (list) => (list.length > 6 ? `${list.slice(0, 6).join(', ')} …` : list.join(', '));
    const parts = [`ว่าง ${free} โต๊ะ`];
    if (busyList.length) parts.push(`ถูกจอง ${busyList.length}: ${short(busyList)}`);
    if (lockList.length) parts.push(`ปิดโดยร้าน ${lockList.length}: ${short(lockList)}`);
    if (!busyList.length && !lockList.length) parts.push('ว่างทั้งหมด');
    return parts.join(' · ');
  }

  function paintPlan() {
    if (!el.planCanvas) return;
    el.planCanvas.querySelectorAll('.plan__spot').forEach((spot) => {
      const id = spot.dataset.table;
      const table = planIndex.get(id) || { id };
      const lockedAt = planLockAt(table);
      const busyAt = lockedAt === null ? planBusyAt(table) : null;
      const picked = pickedTables.includes(id);
      spot.classList.toggle('is-picked', picked);
      spot.classList.toggle('is-locked', lockedAt !== null);
      spot.classList.toggle('is-busy', busyAt !== null);
      spot.setAttribute('aria-pressed', picked ? 'true' : 'false');
      spot.setAttribute('aria-disabled', lockedAt !== null || busyAt !== null ? 'true' : 'false');
      /* the label lives on the table itself so the state reads without a legend */
      const tag = spot.querySelector('.plan__tag');
      if (tag) tag.textContent = lockedAt !== null ? 'ปิด' : busyAt !== null ? 'จองแล้ว' : '';
      if (lockedAt) spot.title = `ปิดโดยร้าน · ${lockedAt}`;
      else if (lockedAt !== null) spot.title = 'ปิดโดยร้าน';
      else if (busyAt) spot.title = `ถูกจอง ${busyAt} น.`;
      else if (busyAt !== null) spot.title = 'ถูกจองแล้ว';
      else spot.removeAttribute('title');
    });
    if (el.planPick) {
      const labels = pickedLabels();
      if (!labels.length) {
        el.planPick.innerHTML = 'แตะโต๊ะบนผังเพื่อเลือก · เลือกได้หลายโต๊ะ';
      } else if (labels.length === 1) {
        el.planPick.innerHTML = `เลือกแล้ว <b>โต๊ะ ${escapeHTML(labels[0])}</b> · แตะเพิ่มได้อีก หรือกรอกข้อมูลด้านล่าง`;
      } else {
        el.planPick.innerHTML = `เลือกแล้ว <b>${labels.length} โต๊ะ</b> · ${escapeHTML(labels.join(', '))}`;
      }
    }
    el.planCanvas.classList.toggle('is-closed', planClosed.closed);
    if (el.planStatus) {
      el.planStatus.textContent = planClosed.closed
        ? `${planClosedHeadline()} — ${PLAN_WALKIN}`
        : planSummary();
    }
  }

  async function loadPlanBusy() {
    const cfg = reserveConfig();
    const plan = planConfig();
    if (!plan) return;
    if (!cfg.webhook) {
      planBusy = new Map();
      planLocks = new Map();
      planClosed = { closed: false, reason: '', closeTime: '', event: null };
      renderPlanClosed();
      paintPlan();
      return;
    }
    const prevBusy = planBusy;
    const prevLocks = planLocks;
    try {
      const url = new URL(cfg.webhook, window.location.href);
      url.searchParams.set('action', 'busy');
      url.searchParams.set('date', el.reserveDate.value || isoDate(new Date()));
      const res = await fetch(url.toString(), { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const next = new Map();
      const locks = new Map();
      ((data && data.busy) || []).forEach((row) => {
        /* locked rows carry no time; booked rows carry the time */
        const target = row && row.locked ? locks : next;
        /* a row may hold a pair ("A1 + A2") or several tables ("9, 24") */
        String((row && row.table) || '')
          .split(/[,+/&]+/)
          .forEach((part) => {
            const id = part.trim().toUpperCase();
            if (!id) return;
            target.set(id, row && row.locked ? String(row.note || '') : String(row.time || ''));
          });
      });
      planBusy = next;
      planLocks = locks;
      /* ร้านอาจปิดรับจองวันที่นี้ (เลยเวลาปิดจอง หรือมีอีเว้นที่ล็อคไว้) */
      planClosed = {
        closed: !!(data && data.closed),
        reason: String((data && data.reason) || ''),
        closeTime: String((data && data.closeTime) || ''),
        event: (data && data.event) || null,
      };
      planFee = (data && data.fee) || null;
      updateReserveSubmit();
      if (planClosed.closed) pickedTables = [];
    } catch (err) {
      /* the map still works without occupancy — every table stays tappable */
      console.warn('[reserve] occupancy unavailable:', err);
      planBusy = prevBusy;
      planLocks = prevLocks;
    }
    renderPlanClosed();
    renderPlanFee();
    paintPlan();
  }

  function pickTable(id) {
    const first = !pickedTables.length;
    pickedTables = pickedTables.includes(id)
      ? pickedTables.filter((t) => t !== id)
      : pickedTables.concat(id);
    paintPlan();
    /* คิดค่าบริการต่อโต๊ะใหม่ทุกครั้งที่แตะเลือก/ยกเลิกโต๊ะ */
    renderPlanFee();
    updateReserveSubmit();
    if (first && pickedTables.length && el.reserveForm) {
      const panel = el.reserveSheet.querySelector('.sheet__panel');
      if (panel) {
        const top = Math.max(0, el.reserveForm.offsetTop - 18);
        panel.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
      }
    }
  }

  function wirePlan() {
    if (!el.planCanvas) return;
    el.planCanvas.addEventListener('click', (event) => {
      const spot = event.target.closest('.plan__spot');
      if (!spot) return;
      const id = spot.dataset.table;
      const table = planIndex.get(id) || { id };
      if (planClosed.closed) {
        toast(`${planClosedHeadline()} — ${PLAN_WALKIN}`);
        return;
      }
      if (planLockAt(table) !== null) {
        toast(`โต๊ะ ${planTableLabel(id)} ถูกปิดโดยร้าน — เลือกโต๊ะอื่น`);
        return;
      }
      const busyAt = planBusyAt(table);
      if (busyAt !== null) {
        toast(`โต๊ะ ${planTableLabel(id)} ถูกจองแล้ว${busyAt ? ` (${busyAt} น.)` : ''} — เลือกโต๊ะอื่น`);
        return;
      }
      pickTable(id);
    });
    el.planFit?.addEventListener('click', () => {
      /* the plan opens full-size, so the button only ever zooms in and back */
      const zoom = el.planCanvas.classList.toggle('is-zoom');
      el.planFit.textContent = zoom ? 'ย่อผัง' : 'ขยายผัง';
      el.planFit.setAttribute('aria-pressed', zoom ? 'true' : 'false');
    });
    el.reserveDate?.addEventListener('change', () => {
      pickedTables = [];
      paintPlan();
      loadPlanBusy();
    });
  }

  function reserveMessage(rec) {
    return [
      'จองโต๊ะ SOD! signature',
      `รหัส: ${rec.code}`,
      `ชื่อ: ${rec.name}`,
      `เบอร์: ${rec.phone}`,
      rec.table ? `โต๊ะ: ${rec.table}` : '',
      `วันที่: ${thaiShortDate(rec.date)} เวลา ${rec.time} น.`,
      `จำนวน: ${rec.party} คน`,
      rec.note ? `หมายเหตุ: ${rec.note}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  function reserveLineHref(rec) {
    const cfg = reserveConfig();
    const text = encodeURIComponent(reserveMessage(rec));
    if (cfg.line_url) {
      if (cfg.line_url.includes('oaMessage')) return (cfg.line_url.includes('?') ? cfg.line_url : `${cfg.line_url}/?`) + text;
      return cfg.line_url;
    }
    return `https://line.me/R/share?text=${text}`;
  }

  function syncReserveUI() {
    const cfg = reserveConfig();
    const on = cfg.enabled !== false;
    if (el.reserveOpen) el.reserveOpen.hidden = !on;
    if (el.reserveHint) el.reserveHint.textContent = cfg.hint || RESERVE_DEFAULTS.hint;
    if (el.reserveParty) {
      const max = Math.max(1, Number(cfg.max_party) || 20);
      const picked = Number(el.reserveParty.value);
      el.reserveParty.innerHTML = Array.from(
        { length: max },
        (_, i) => `<option value="${i + 1}">${i + 1} คน</option>`
      ).join('');
      el.reserveParty.value = String(picked >= 1 && picked <= max ? picked : Math.min(2, max));
    }
    if (el.planBox) {
      el.planBox.hidden = !planConfig();
      if (planConfig()) buildPlan();
    }
    if (el.reserveLast) {
      const last = readReserveRecord();
      const today = isoDate(new Date());
      if (last && last.date >= today) {
        el.reserveLast.hidden = false;
        el.reserveLast.innerHTML = `การจองล่าสุด <b>${escapeHTML(last.code)}</b> · ${escapeHTML(
          thaiShortDate(last.date)
        )} ${escapeHTML(last.time)} · ${escapeHTML(String(last.party))} คน`;
      } else {
        el.reserveLast.hidden = true;
        el.reserveLast.textContent = '';
      }
    }
  }

  function openReserve() {
    if (!el.reserveSheet || !el.reserveSheet.hidden) return;
    const cfg = reserveConfig();
    if (cfg.enabled === false) return;
    reserveReturnFocus = document.activeElement;
    pickedTables = [];
    syncReserveUI();
    paintPlan();
    loadPlanBusy();
    el.reserveForm.hidden = false;
    el.reserveDone.hidden = true;
    el.reserveErr.hidden = true;
    stopReserveReturn();
    const now = new Date();
    el.reserveDate.min = isoDate(now);
    if (!el.reserveDate.value) {
      const slot = nextBookableTime(cfg);
      el.reserveDate.value = isoDate(slot);
      el.reserveTime.value = `${pad2(slot.getHours())}:${pad2(slot.getMinutes())}`;
    }
    const last = readReserveRecord();
    if (last) {
      if (!el.reserveName.value) el.reserveName.value = last.name || '';
      if (!el.reservePhone.value) el.reservePhone.value = last.phone || '';
    }
    el.reserveSheet.hidden = false;
    document.body.classList.add('has-sheet');
    (el.reserveName.value ? el.reserveSubmit : el.reserveName).focus();
  }

  function closeReserve() {
    if (!el.reserveSheet || el.reserveSheet.hidden) return;
    stopReserveReturn();
    el.reserveSheet.hidden = true;
    document.body.classList.remove('has-sheet');
    if (reserveReturnFocus && typeof reserveReturnFocus.focus === 'function') reserveReturnFocus.focus();
  }

  function reserveError(message) {
    if (!el.reserveErr) return false;
    el.reserveErr.hidden = !message;
    el.reserveErr.textContent = message || '';
    if (message) el.reserveErr.scrollIntoView({ block: 'nearest' });
    return !message;
  }

  function readReserveForm() {
    const cfg = reserveConfig();
    const name = el.reserveName.value.trim();
    const phone = el.reservePhone.value.replace(/\D/g, '');
    const date = el.reserveDate.value;
    const time = el.reserveTime.value;
    const party = Number(el.reserveParty.value) || 0;
    const note = el.reserveNote.value.trim();
    const maxParty = Math.max(1, Number(cfg.max_party) || 20);

    if (planConfig() && !pickedTables.length) return { error: 'แตะเลือกโต๊ะบนผังก่อนยืนยันการจอง' };
    if (name.length < 2) return { error: 'กรุณากรอกชื่อผู้จอง' };
    if (phone.length < 9 || phone.length > 10) return { error: 'กรุณากรอกเบอร์โทรให้ครบ (9–10 หลัก)' };
    if (!date) return { error: 'กรุณาเลือกวันที่ต้องการจอง' };
    if (!time) return { error: 'กรุณาเลือกเวลาที่ต้องการจอง' };
    if (!party || party > maxParty) return { error: `จำนวนคนต้องอยู่ระหว่าง 1–${maxParty}` };

    const when = new Date(`${date}T${time}:00`);
    if (Number.isNaN(when.getTime())) return { error: 'วันหรือเวลาไม่ถูกต้อง' };
    if (!inService(when.getHours() * 60 + when.getMinutes(), hhmmToMin(cfg.open_time), hhmmToMin(cfg.close_time))) {
      return { error: `ร้านรับจองช่วง ${cfg.open_time}–${cfg.close_time} น.` };
    }
    if (when.getTime() < Date.now() + 14 * 60000) return { error: 'เวลานี้ผ่านมาแล้ว หรือใกล้อีกเกินไป' };
    const maxDays = Number(cfg.max_days) || 30;
    if (when.getTime() > Date.now() + maxDays * 86400000) return { error: `จองล่วงหน้าได้ไม่เกิน ${maxDays} วัน` };

    return {
      rec: {
        code: makeReserveCode(),
        name,
        phone,
        date,
        time,
        party,
        table: pickedTables.length ? pickedLabels().join(', ') : '',
        note,
        created_at: new Date().toISOString(),
      },
    };
  }

  function renderReserveDone(rec, status, fee) {
    reserveCurrent = rec;
    el.reserveForm.hidden = true;
    el.reserveDone.hidden = false;
    el.reserveCode.textContent = rec.code;
    const rows = [
      ['ชื่อ', rec.name],
      ['เบอร์', rec.phone],
      ['วันเวลา', `${thaiShortDate(rec.date)} · ${rec.time} น.`],
      ['จำนวน', `${rec.party} คน`],
    ];
    if (rec.table) rows.push(['โต๊ะ', rec.table]);
    if (rec.note) rows.push(['หมายเหตุ', rec.note]);
    el.reserveSummary.innerHTML = rows
      .map(([k, v]) => `<div class="reserve__row"><dt>${escapeHTML(k)}</dt><dd>${escapeHTML(String(v))}</dd></div>`)
      .join('');
    el.reserveStatus.textContent = status;
    /* มีค่าบริการ = ต้องโชว์ยอดให้โอน และไม่เด้งกลับฟอร์มตามเวลา (ลูกค้าต้องมีเวลาจ่าย) */
    const due = fee && Number(fee.total) > 0 ? Number(fee.total) : 0;
    if (el.reserveDoneTitle) {
      el.reserveDoneTitle.textContent = due ? 'ชำระเงินเพื่อให้การจองสำเร็จ' : 'ได้รับคำขอจองแล้ว';
    }
    if (el.reservePay) {
      el.reservePay.hidden = !due;
      if (due) {
        resetSlipUI();
        startHoldTimer(fee);
        /* สลิปถูกส่งไปแล้ว (เช่น เปิดใบจองเดิมหลังรีหน้า) → ไม่ต้องให้ส่งซ้ำ */
        if (fee.slipStatus === 'รอตรวจ') {
          if (el.reserveSlipSend) el.reserveSlipSend.hidden = true;
          if (el.reserveSlipDrop) el.reserveSlipDrop.hidden = true;
          slipSay('ได้รับสลิปแล้ว ✓ ร้านกำลังตรวจสอบ จะยืนยันการจองให้หลังตรวจเสร็จ', false);
        }
        /* หน้าชำระเงินเต็มรูปแบบ: ยอด + ช่องทางโอน + แนบสลิป (pay.html) */
        if (el.reservePayLink) el.reservePayLink.href = `./pay.html?code=${encodeURIComponent(rec.code)}`;
        el.reservePayAmount.textContent = `฿${due.toLocaleString('th-TH')}`;
        el.reservePayHow.textContent = [
          fee.pay ? `โอนที่ ${fee.pay}` : 'โอนตามช่องทางที่ร้านแจ้ง',
          fee.note || '',
          `โอนแล้วส่งสลิปทาง LINE พร้อมรหัส ${rec.code}`,
        ]
          .filter(Boolean)
          .join(' · ');
      }
    }
    el.reserveShare.href = reserveLineHref(rec);
    const tel = String(reserveConfig().phone || '').replace(/[^\d+]/g, '');
    el.reserveCall.hidden = !tel;
    if (tel) el.reserveCall.href = `tel:${tel}`;
    const panel = el.reserveSheet.querySelector('.sheet__panel');
    if (panel) panel.scrollTop = 0;
    if (due) stopReserveReturn();
    else startReserveReturn();
  }

  /* After a booking the sheet parks on the summary so the guest can read the
     code. The counter is walk-up, so the next guest gets the form back by
     itself — unless someone touches the summary, which stops the countdown. */
  const RESERVE_RETURN_MS = 10000;
  let reserveTimer = 0;

  function stopReserveReturn() {
    if (reserveTimer) clearInterval(reserveTimer);
    reserveTimer = 0;
    if (el.reserveAuto) {
      el.reserveAuto.hidden = true;
      el.reserveAuto.textContent = '';
    }
  }

  function startReserveReturn() {
    if (!el.reserveAuto) return;
    stopReserveReturn();
    let left = Math.round(RESERVE_RETURN_MS / 1000);
    const paint = () => {
      el.reserveAuto.hidden = false;
      el.reserveAuto.textContent = `กลับหน้าจองในอีก ${left} วินาที · แตะหน้านี้เพื่อหยุด`;
    };
    paint();
    reserveTimer = setInterval(() => {
      left -= 1;
      if (left > 0) {
        paint();
        return;
      }
      resetReserveForm();
    }, 1000);
  }

  function resetReserveForm() {
    stopReserveReturn();
    stopHoldTimer();
    el.reserveDone.hidden = true;
    el.reserveForm.hidden = false;
    el.reserveErr.hidden = true;
    if (el.reservePay) el.reservePay.hidden = true;
    el.reserveNote.value = '';
    el.reserveSubmit.disabled = false;
    el.reserveSubmit.textContent = reserveSubmitLabel();
    pickedTables = [];
    paintPlan();
    loadPlanBusy();
    el.reserveName.focus();
  }

  async function submitReserve(e) {
    e.preventDefault();
    if (planClosed.closed) {
      reserveError(`${planClosedHeadline()} — ${PLAN_WALKIN}`);
      return;
    }
    if (el.reserveSubmit.disabled) return;
    const { rec, error } = readReserveForm();
    if (!reserveError(error)) return;
    const cfg = reserveConfig();

    el.reserveSubmit.disabled = true;
    el.reserveSubmit.textContent = 'กำลังส่ง…';
    saveReserveRecord(rec);

    let status = 'บันทึกการจองไว้ในเครื่องนี้แล้ว — ส่งข้อความให้ร้านทาง LINE เพื่อยืนยันได้เลย';
    let fee = null;
    if (cfg.webhook) {
      try {
        /* text/plain keeps the request "simple", so the browser skips the CORS
           preflight that an Apps Script web app cannot answer. The body is still
           JSON, and the receiver parses it as JSON. */
        const res = await fetch(cfg.webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(Object.assign({ source: 'sod-menu' }, rec)),
          keepalive: true,
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        let answer = null;
        try {
          answer = await res.json();
        } catch (_) {
          /* older deployments answer with plain text; a 2xx is enough then */
        }
        if (answer && answer.ok === false) throw new Error(answer.error || 'receiver rejected');
        if (answer && answer.fee && Number(answer.fee.total) > 0) {
          fee = answer.fee;
          /* เวลาถือโต๊ะ 15 นาที — เอาไปนับถอยหลังในป็อปอัป */
          fee.expiresAt = answer.expiresAt || '';
          fee.holdMinutes = Number(answer.holdMinutes) || 15;
          status = `รอชำระค่าบริการ ฿${Number(answer.fee.total).toLocaleString('th-TH')} — ชำระเงินและแนบสลิปด้านล่างเพื่อจองให้สำเร็จ`;
        } else {
          status = `ส่งคำขอถึงร้านแล้ว — รอร้านติดต่อกลับที่ ${rec.phone}`;
        }
      } catch (err) {
        console.error('[reserve] webhook failed:', err);
        status = 'ส่งอัตโนมัติไม่สำเร็จ — กรุณาส่งข้อความทาง LINE หรือโทรหาร้าน';
      }
    }

    el.reserveSubmit.disabled = false;
    el.reserveSubmit.textContent = reserveSubmitLabel();
    renderReserveDone(rec, status, fee);
    syncReserveUI();
    toast('ได้รับคำขอจองแล้ว · ' + rec.code);
  }

  async function copyReserve(rec) {
    const text = reserveMessage(rec);
    try {
      await navigator.clipboard.writeText(text);
      toast('คัดลอกข้อความแล้ว');
      return;
    } catch (_) {
      /* clipboard API blocked — fall back to a hidden selection */
    }
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    try {
      document.execCommand('copy');
      toast('คัดลอกข้อความแล้ว');
    } catch (_) {
      toast('คัดลอกไม่สำเร็จ — เลือกข้อความด้วยตัวเอง');
    }
    area.remove();
  }

  /* ── นับถอยหลัง 15 นาที: ชำระไม่ทัน = ระบบคืนโต๊ะ ── */
  let holdTimer = 0;

  function stopHoldTimer() {
    if (holdTimer) clearInterval(holdTimer);
    holdTimer = 0;
  }

  function startHoldTimer(fee) {
    stopHoldTimer();
    if (!el.reserveHold) return;
    const until = fee && fee.expiresAt ? Date.parse(fee.expiresAt) : 0;
    if (!until) {
      el.reserveHold.hidden = true;
      return;
    }
    const minutes = Number(fee.holdMinutes) || 15;
    const paint = () => {
      const left = until - Date.now();
      if (left <= 0) {
        stopHoldTimer();
        el.reserveHold.hidden = false;
        el.reserveHold.classList.add('is-over');
        el.reserveHold.textContent = `หมดเวลา ${minutes} นาที — การจองนี้ถูกยกเลิกและคืนโต๊ะแล้ว กรุณาจองใหม่`;
        if (el.reserveSlipSend) el.reserveSlipSend.hidden = true;
        if (el.reserveStatus) el.reserveStatus.textContent = 'การจองถูกยกเลิก (ไม่ได้ชำระภายใน 15 นาที)';
        if (el.reserveDoneTitle) el.reserveDoneTitle.textContent = 'หมดเวลาชำระเงิน';
        return;
      }
      const mins = Math.floor(left / 60000);
      const secs = Math.floor((left % 60000) / 1000);
      el.reserveHold.hidden = false;
      el.reserveHold.classList.remove('is-over');
      el.reserveHold.textContent = `ต้องชำระเงินให้เสร็จใน ${mins}:${pad2(secs)} น. ไม่งั้นระบบคืนโต๊ะ · บัตรจองจะออกหลังร้านตรวจสลิป`;
    };
    paint();
    holdTimer = setInterval(paint, 1000);
  }

  /* ── แนบสลิปในป็อปอัปจอง (ไม่ต้องออกไปหน้าอื่น) ── */
  let slipPicked = '';

  function slipSay(text, bad) {
    if (!el.reserveSlipMsg) return;
    el.reserveSlipMsg.hidden = !text;
    el.reserveSlipMsg.textContent = text || '';
    el.reserveSlipMsg.className = 'reserve__slip-msg' + (bad ? ' is-bad' : '');
  }

  function resetSlipUI() {
    slipPicked = '';
    if (el.reserveSlipDrop) el.reserveSlipDrop.hidden = false;
    if (el.reserveSlipFile) el.reserveSlipFile.value = '';
    if (el.reserveSlipPreview) el.reserveSlipPreview.hidden = true;
    if (el.reserveSlipSend) {
      el.reserveSlipSend.hidden = false;
      el.reserveSlipSend.disabled = true;
      el.reserveSlipSend.textContent = 'ส่งสลิปให้ร้านยืนยัน';
    }
    if (el.reserveSlipText) el.reserveSlipText.textContent = 'แตะเพื่อเลือกรูปสลิป';
    slipSay('');
  }

  /* ย่อรูปในเบราว์เซอร์ก่อนส่ง — สลิปยังอ่านเลขได้ แต่ไฟล์เล็กลงมาก */
  function shrinkSlip(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('อ่านไฟล์ไม่ได้'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('ไฟล์นี้ไม่ใช่รูปภาพ'));
        img.onload = () => {
          const max = 1280;
          const scale = Math.min(1, max / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.72));
        };
        img.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    });
  }

  async function sendSlip() {
    const code = (reserveCurrent && reserveCurrent.code) || '';
    const webhook = reserveConfig().webhook;
    if (!code || !slipPicked) return;
    if (!webhook) {
      slipSay('ยังเชื่อมต่อระบบจองไม่ได้ — ส่งสลิปให้ร้านทาง LINE แทน', true);
      return;
    }
    if (el.reserveSlipSend) {
      el.reserveSlipSend.disabled = true;
      el.reserveSlipSend.textContent = 'กำลังส่ง…';
    }
    slipSay('');
    try {
      const res = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'submit-slip', code, image: slipPicked }),
      });
      const data = await res.json();
      if (!data || data.ok === false) throw new Error((data && data.error) || 'HTTP ' + res.status);
      if (el.reserveSlipSend) el.reserveSlipSend.hidden = true;
      if (el.reserveStatus) el.reserveStatus.textContent = 'ส่งสลิปแล้ว — รอร้านตรวจสอบและยืนยันการจอง';
      slipSay(`ได้รับสลิปแล้ว ✓ ร้านจะยืนยันการจองให้หลังตรวจสอบ · เก็บรหัส ${code} ไว้ด้วย`);
      toast('ส่งสลิปให้ร้านแล้ว · ' + code);
    } catch (err) {
      if (el.reserveSlipSend) {
        el.reserveSlipSend.disabled = false;
        el.reserveSlipSend.textContent = 'ส่งสลิปให้ร้านยืนยัน';
      }
      slipSay('ส่งสลิปไม่สำเร็จ — ' + String((err && err.message) || err) + ' ลองอีกครั้งหรือส่งทาง LINE', true);
      if (el.reserveSlipSend && /หมดเวลา/.test(String((err && err.message) || ''))) el.reserveSlipSend.hidden = true;
    }
  }

  /* ── เปิดใบจองที่บันทึกไว้ในเครื่อง — ต้องถามหลังบ้านก่อนเสมอ
     เดิมกด “การจองล่าสุด” แล้วขึ้นสถานะเหมือนจองสำเร็จ ทั้งที่ยังไม่ได้ชำระ
     ตอนนี้ใช้ข้อมูลจริงจาก ?action=order (paid / expired / ยอดค้าง) เป็นตัวตัดสิน */
  async function showSavedReserve() {
    const last = readReserveRecord();
    if (!last) return;
    const webhook = reserveConfig().webhook;
    let status = 'ยังไม่ยืนยันกับร้าน — ส่งข้อความทาง LINE หรือโทรหาร้านได้เลย';
    let fee = null;
    if (webhook && last.code) {
      try {
        const res = await fetch(`${webhook}?action=order&code=${encodeURIComponent(last.code)}`, { cache: 'no-store' });
        const data = await res.json();
        if (data && data.ok === false && /not found/.test(String(data.error || ''))) {
          status = 'ไม่พบใบจองนี้ในระบบแล้ว (ถูกยกเลิกหรือหมดเวลาชำระ) — การจองยังไม่สำเร็จ กรุณาจองใหม่';
        } else if (data && data.order) {
          const order = data.order;
          const due = Number(order.total) || 0;
          if (order.paid || order.status === 'ยืนยันแล้ว') {
            status = 'ชำระเงินแล้ว — การจองยืนยันสำเร็จ แสดงรหัสนี้กับพนักงานที่ร้าน';
          } else if (order.slipStatus === 'รอตรวจ') {
            status = 'ส่งสลิปแล้ว — รอร้านตรวจสอบและยืนยันการจอง';
            fee = {
              total: due,
              amount: Number(order.amount) || due,
              per: order.per || 'table',
              pay: order.pay || '',
              note: order.note || '',
              expiresAt: order.expiresAt || '',
              holdMinutes: Number(order.holdMinutes) || 15,
              slipStatus: 'รอตรวจ',
            };
          } else if (order.expired) {
            status = 'หมดเวลาชำระเงิน — การจองนี้ถูกยกเลิกและคืนโต๊ะแล้ว กรุณาจองใหม่';
          } else if (due > 0) {
            status = `รอชำระค่าบริการ ฿${due.toLocaleString('th-TH')} — ชำระและแนบสลิปด้านล่างเพื่อให้การจองสำเร็จ`;
            fee = {
              total: due,
              amount: Number(order.amount) || due,
              per: order.per || 'table',
              pay: order.pay || '',
              note: order.note || '',
              expiresAt: order.expiresAt || '',
              holdMinutes: Number(order.holdMinutes) || 15,
            };
          } else {
            status = 'รอร้านยืนยันการจอง — ยังไม่มีการชำระเงินที่ต้องทำ';
          }
        }
      } catch (err) {
        console.warn('[reserve] saved order lookup failed:', err);
      }
    }
    if (el.reserveSheet && el.reserveSheet.hidden) {
      el.reserveSheet.hidden = false;
      document.body.classList.add('has-sheet');
    }
    renderReserveDone(last, status, fee);
  }

  function wireReserve() {
    if (!el.reserveSheet) return;
    el.reserveOpen?.addEventListener('click', openReserve);
    if (reserveTapPending) {
      reserveTapPending = false;
      openReserve();
    }
    el.reserveX?.addEventListener('click', closeReserve);
    el.reserveScrim?.addEventListener('click', closeReserve);
    el.reserveForm?.addEventListener('submit', submitReserve);
    el.reserveCopy?.addEventListener('click', () => {
      if (reserveCurrent) copyReserve(reserveCurrent);
    });
    el.reserveAgain?.addEventListener('click', resetReserveForm);
    el.reserveSlipFile?.addEventListener('change', async () => {
      const file = el.reserveSlipFile.files && el.reserveSlipFile.files[0];
      if (!file) return;
      slipSay('');
      if (el.reserveSlipSend) el.reserveSlipSend.disabled = true;
      try {
        slipPicked = await shrinkSlip(file);
        if (el.reserveSlipImg) el.reserveSlipImg.src = slipPicked;
        if (el.reserveSlipPreview) el.reserveSlipPreview.hidden = false;
        if (el.reserveSlipText) el.reserveSlipText.textContent = file.name || 'เลือกแล้ว';
        if (el.reserveSlipSend) el.reserveSlipSend.disabled = false;
      } catch (err) {
        slipPicked = '';
        slipSay(String((err && err.message) || err), true);
      }
    });
    el.reserveSlipSend?.addEventListener('click', sendSlip);
    el.reserveParty?.addEventListener('change', updateReserveSubmit);
    el.reserveParty?.addEventListener('input', updateReserveSubmit);
    el.reservePayCopy?.addEventListener('click', async () => {
      const text = [el.reservePayAmount.textContent, el.reservePayHow.textContent].filter(Boolean).join('\n');
      try {
        await navigator.clipboard.writeText(text);
        toast('คัดลอกข้อมูลชำระเงินแล้ว');
      } catch (_) {
        toast('คัดลอกไม่สำเร็จ — เลือกข้อความด้วยตัวเอง');
      }
    });
    /* touching the summary means someone is reading it — keep it on screen */
    el.reserveDone?.addEventListener('pointerdown', stopReserveReturn);
    el.reserveDone?.addEventListener('keydown', stopReserveReturn);
    el.reserveLast?.addEventListener('click', showSavedReserve);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && el.reserveSheet && !el.reserveSheet.hidden) closeReserve();
    });
  }

  /* ── Hidden staff door ──────────────────────────────────────
     Five quick taps on the logo open today.html. Nothing on the page
     points at it, so guests never stumble into the staff list. */
  function wireStaffDoor() {
    let taps = 0;
    let timer = 0;
    if (!el.brandLogo) return;
    el.brandLogo.addEventListener('click', () => {
      taps += 1;
      clearTimeout(timer);
      timer = setTimeout(() => (taps = 0), 1600);
      if (taps < 5) return;
      taps = 0;
      clearTimeout(timer);
      window.location.href = './today.html';
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

  /* ปุ่ม “จองโต๊ะ” อยู่ใน HTML ตั้งแต่แรก แต่ handler ถูกผูกหลังโหลดข้อมูลเสร็จ
     ระหว่าง 1–2 วินาทีนั้นการแตะจะเงียบสนิท — จำการแตะไว้แล้วเปิดป็อปอัปให้ทันทีที่พร้อม */
  let reserveTapPending = false;
  document.addEventListener(
    'click',
    (event) => {
      const target = event.target instanceof Element ? event.target.closest('#reserveOpen') : null;
      if (!target || state.data) return;
      reserveTapPending = true;
    },
    true,
  );

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
  wireReserve();
  wirePlan();
  wireStaffDoor();
  wireToTop();
  wireTabs();
  wireScrollSpy();
  boot();
})();
