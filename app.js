/* SOD! signature — menu site logic
   Static, no build step. All content comes from ./data/menu.json */

(() => {
  'use strict';

  // Bump together with "version" in data/menu.json so browsers drop the cache.
  const ASSET_VERSION = '1.0.1';
  const DATA_URL = './data/menu.json';
  const AUTOPLAY_MS = 4200;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const $ = (id) => document.getElementById(id);

  const el = {
    intro: $('intro'),
    introSkip: $('introSkip'),
    brandLogo: $('brandLogo'),
    brandSub: $('brandSub'),
    promoNote: $('promoNote'),
    promoLabel: $('promoLabel'),
    tabBefore: $('tabBefore'),
    tabAfter: $('tabAfter'),
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
    const timer = setTimeout(finish, reduceMotion ? 500 : 2200);
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
  function slideHTML(slide) {
    const art = slide.image
      ? `<img class="slide__art" src="./${slide.image.replace(/^\.\//, '')}" alt="${escapeAttr(slide.name)}" width="180" height="180" loading="lazy" decoding="async" data-icon="spirit" />`
      : `<div class="slide__icon">${iconMarkup('spirit')}</div>`;
    const price =
      slide.price === null || slide.price === undefined
        ? '<p class="slide__price"><span class="slide__price-num">สอบถามราคา</span></p>'
        : `<p class="slide__price"><span class="slide__price-num">${THB(slide.price)}</span><small>เซ็ต</small></p>`;
    return `<article class="slide" aria-label="${escapeAttr(slide.name)}">
      <div class="slide__text">
        <span class="slide__tag">${state.mode === 'before_midnight' ? 'ก่อนเที่ยงคืน' : 'หลังเที่ยงคืน'}</span>
        <h3 class="slide__name">${escapeHTML(slide.name)}</h3>
        ${price}
      </div>
      ${art}
    </article>`;
  }

  function renderPromotions() {
    const promo = state.data?.promotions?.[state.mode];
    if (!promo || !el.track) return;

    const sets = [...(promo.sets || []), ...(promo.beer || [])];
    el.track.innerHTML = sets.map((s) => slideHTML(s)).join('');
    el.dots.innerHTML = sets
      .map(
        (s, i) =>
          `<button class="slider__dot" type="button" aria-label="สไลด์ ${i + 1}: ${escapeAttr(s.name)}"></button>`
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

    state.promoSlides = sets;
    state.slides = Array.from(el.track.children);
    state.slideIndex = 0;
    el.track.scrollTo({ left: 0, behavior: 'auto' });
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
  }

  function setModeChrome() {
    const before = state.mode === 'before_midnight';
    if (!el.tabBefore || !el.tabAfter) return;
    el.tabBefore.classList.toggle('is-active', before);
    el.tabAfter.classList.toggle('is-active', !before);
    el.tabBefore.setAttribute('aria-pressed', String(before));
    el.tabAfter.setAttribute('aria-pressed', String(!before));
  }

  function setMode(mode) {
    if (state.mode === mode || !state.data) return;
    state.mode = mode;
    renderPromotions();
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
    const offset = target.getBoundingClientRect().left - el.track.getBoundingClientRect().left + el.track.scrollLeft;
    el.track.scrollTo({ left: offset, behavior: reduceMotion ? 'auto' : 'smooth' });
    syncDots();
    activateSlide(state.slideIndex, userInitiated);
    if (userInitiated) pauseAutoplay(6000);
  }

  function onSliderScroll() {
    if (Date.now() < state.scrollLockUntil) return;
    const left = el.track.scrollLeft;
    let best = 0;
    let bestDelta = Infinity;
    state.slides.forEach((s, i) => {
      const delta = Math.abs(
        s.getBoundingClientRect().left - el.track.getBoundingClientRect().left + el.track.scrollLeft - left
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
    if (reduceMotion || state.slides.length < 2) return;
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
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToSlide(state.slideIndex + 1);
      } else if (e.key === 'ArrowLeft') {
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
    const media = src
      ? `<img class="card__img" src="${src}" alt="${escapeAttr(item.name)}" width="320" height="320" loading="lazy" decoding="async" data-icon="${cat.id}" />`
      : `<span class="card__icon">${iconMarkup(cat.id)}</span>`;
    const price =
      item.price === null || item.price === undefined
        ? '<p class="card__price card__price--ask">สอบถามราคา</p>'
        : `<p class="card__price">${THB(item.price)}</p>`;
    return `<article class="card reveal" data-name="${escapeAttr(item.name.toLowerCase())}">
      <div class="card__media">${media}</div>
      <h3 class="card__name">${escapeHTML(item.name)}</h3>
      ${price}
    </article>`;
  }

  function renderMenu() {
    const { categories = [], items = [] } = state.data;
    el.tabs.innerHTML = categories
      .map(
        (c) =>
          `<button class="tab" type="button" data-cat="${c.id}" aria-controls="cat-${c.id}">
            <span aria-hidden="true">${c.icon || ''}</span>${escapeHTML(c.name)}
          </button>`
      )
      .join('');

    el.body.innerHTML = categories
      .map((c) => {
        const list = items.filter((i) => i.cat === c.id);
        if (!list.length) return '';
        return `<section class="cat-block" id="cat-${c.id}" aria-labelledby="cat-${c.id}-title">
          <div class="cat-block__head">
            <h3 class="cat-block__title" id="cat-${c.id}-title">
              <span aria-hidden="true">${c.icon || ''}</span> ${escapeHTML(c.name)}
            </h3>
            <span class="cat-block__count">${list.length} รายการ</span>
            <span class="cat-block__rule" aria-hidden="true"></span>
          </div>
          <div class="grid">${list.map((i) => cardHTML(i, c)).join('')}</div>
        </section>`;
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

    const total = items.length;
    el.status.textContent = `${total} รายการ · เวอร์ชัน ${state.data.version || '1.0.0'}`;
    el.footerMeta.textContent = `เมนูเวอร์ชัน ${state.data.version || '1.0.0'}`;

    observeReveal();
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
      if (active) tab.scrollIntoView({ inline: 'center', block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
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
    el.status.textContent = q ? `พบ ${shown} รายการ จากคำค้น “${state.query.trim()}”` : `${state.data.items.length} รายการ · เวอร์ชัน ${state.data.version}`;
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
      state.mode = detectMode();
      renderPromotions();
      renderMenu();
      el.error.hidden = true;
    } catch (err) {
      console.error('[menu] load failed:', err);
      el.status.textContent = '';
      showError('โหลดเมนูไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อหรือรีเฟรชหน้านี้อีกครั้ง', true);
    }
  }

  /* ── Init ──────────────────────────────────────────────────── */
  startIntro();
  wireSlider();
  wireSearch();
  wireToTop();
  wireTabs();
  wireScrollSpy();
  boot();
})();
