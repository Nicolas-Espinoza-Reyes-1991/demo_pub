(function () {
  'use strict';

  var WA_URL = 'https://wa.me/56993015918?text=' + encodeURIComponent('Hola, estoy en mesa y quisiera hacer un pedido en After Office Resto-Bar');

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function shortLabel(label, max) {
    var s = String(label || '').replace(/\s+/g, ' ').trim();
    if (s.length <= max) return s;
    return s.slice(0, max - 1) + '…';
  }

  function showCartaError(msg) {
    var list = document.getElementById('carta-list');
    if (list) {
      list.innerHTML = '<p class="carta-empty font-lato">' + escapeHtml(msg) + '</p>';
    }
  }

  function applyTheme() {
    var body = document.body;
    body.classList.add('site-neon', 'carta-page--neon', 'font-outfit');
    body.classList.remove('carta-page--classic', 'carta-page--industrial', 'font-playfair', 'font-oswald');

    var back = document.getElementById('carta-back');
    if (back) back.setAttribute('href', 'index.html#inicio');

    var title = document.getElementById('carta-title');
    if (title) {
      title.className = 'font-outfit text-2xl sm:text-3xl font-bold carta-title mb-2';
      title.innerHTML = '<span class="neon-text-cyan">Menú</span> <span class="text-fuchsia-400 neon-text-magenta">Nocturno</span>';
    }

    var sub = document.getElementById('carta-subtitle');
    if (sub) {
      sub.className = 'text-stone-400 text-sm mt-1 font-lato';
      sub.textContent = 'Carta completa · Comida, tragos, cervezas y más';
    }

    var brand = document.getElementById('carta-brand');
    if (brand) {
      brand.className = 'brand-wordmark brand-wordmark--sm brand-wordmark--neon text-center flex-1';
      brand.setAttribute('href', 'index.html#inicio');
    }

    var foot = document.getElementById('carta-foot-link');
    if (foot) {
      foot.setAttribute('href', 'index.html#inicio');
      foot.className = 'carta-foot-link btn-cta btn-cta--neon-outline inline-flex mt-4 text-sm';
      foot.textContent = 'Volver al sitio';
    }

    var pill = document.getElementById('carta-pill');
    if (pill) {
      pill.className = 'section-eyebrow carta-hero-mini__pill';
      pill.textContent = 'Carta nocturna';
    }

    document.title = 'Menú Nocturno · After Office Futrono';
  }

  function renderTabs(tabs, active) {
    var nav = document.getElementById('carta-tabs');
    if (!nav) return;
    nav.innerHTML = tabs.map(function (t) {
      var on = t.id === active;
      var label = escapeHtml(shortLabel(t.label, 16));
      var full = escapeHtml(t.label);
      return (
        '<button type="button" role="tab" aria-selected="' + on + '" ' +
        'data-carta-tab="' + escapeHtml(t.id) + '" ' +
        'class="carta-tab' + (on ? ' carta-tab--active' : '') + '" ' +
        'title="' + full + '">' + label + '</button>'
      );
    }).join('');
  }

  function renderSectionsSheet(tabs, active) {
    var list = document.getElementById('carta-sections-list');
    if (!list) return;
    list.innerHTML = tabs.map(function (t, i) {
      var on = t.id === active;
      return (
        '<li class="carta-sheet__item-wrap">' +
          '<button type="button" class="carta-sheet__item' + (on ? ' carta-sheet__item--active' : '') + '" ' +
          'data-carta-sheet-tab="' + escapeHtml(t.id) + '">' +
            '<span class="carta-sheet__item-num">' + (i + 1) + '</span>' +
            '<span class="carta-sheet__item-label">' + escapeHtml(t.label) + '</span>' +
          '</button>' +
        '</li>'
      );
    }).join('');
  }

  function collectItems(items, category, query) {
    var q = (query || '').trim().toLowerCase();
    var pool = [];

    if (q) {
      Object.keys(items).forEach(function (cat) {
        (items[cat] || []).forEach(function (item) {
          var hay = (item.name + ' ' + item.desc + ' ' + (item.tags || []).join(' ')).toLowerCase();
          if (hay.indexOf(q) !== -1) pool.push(item);
        });
      });
      return pool;
    }

    return (items[category] || []).slice();
  }

  function renderItems(items, category, query) {
    var list = document.getElementById('carta-list');
    if (!list) return;

    var catItems = collectItems(items, category, query);
    var q = (query || '').trim();

    if (!catItems.length) {
      list.innerHTML = '<p class="carta-empty font-lato">' +
        (q ? 'No encontramos platos con ese filtro.' : 'No hay productos en esta sección.') +
        '</p>';
      return;
    }

    list.innerHTML = catItems.map(function (item) {
      var name = escapeHtml(item.name);
      var desc = escapeHtml(item.desc);
      var img = escapeHtml(item.img);
      return (
        '<article class="carta-item card-hover" data-name="' + name.toLowerCase() + '">' +
          '<div class="carta-item__img-wrap neon-border">' +
            '<img data-img="' + img + '" alt="' + name + '" loading="lazy" decoding="async" width="88" height="88">' +
          '</div>' +
          '<div class="carta-item__body">' +
            '<h3 class="carta-item__title font-outfit">' + name + '</h3>' +
            '<p class="carta-item__desc font-lato">' + desc + '</p>' +
            '<div class="carta-item__foot">' +
              '<span class="carta-item__price">' + escapeHtml(item.price) + '</span>' +
              (item.tags && item.tags.length ? '<span class="carta-item__tags font-lato">' + item.tags.slice(0, 2).map(function (t) {
                return '<span class="carta-item__tag">' + escapeHtml(t) + '</span>';
              }).join('') + '</span>' : '') +
            '</div>' +
          '</div>' +
        '</article>'
      );
    }).join('');

    if (window.AOImages) AOImages.initImages(list);
  }

  function updateSearchUI(query) {
    var sticky = document.querySelector('.carta-sticky-tools');
    var hasQuery = !!(query || '').trim();
    if (sticky) sticky.classList.toggle('is-searching', hasQuery);
  }

  function scrollActiveTabIntoView() {
    var nav = document.getElementById('carta-tabs');
    if (!nav) return;
    var activeBtn = nav.querySelector('.carta-tab--active');
    if (!activeBtn) return;
    activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }

  function updateTabsScrollState() {
    var wrap = document.querySelector('[data-carta-tabs-wrap]');
    var nav = document.getElementById('carta-tabs');
    if (!wrap || !nav) return;

    var maxScroll = nav.scrollWidth - nav.clientWidth;
    var canScroll = maxScroll > 4;
    var prev = wrap.querySelector('[data-carta-scroll="prev"]');
    var next = wrap.querySelector('[data-carta-scroll="next"]');

    if (prev) prev.hidden = !canScroll;
    if (next) next.hidden = !canScroll;

    wrap.classList.toggle('is-scroll-start', nav.scrollLeft <= 4);
    wrap.classList.toggle('is-scroll-end', nav.scrollLeft >= maxScroll - 4);
    wrap.classList.toggle('is-scrollable', canScroll);
  }

  function initTabsScroll() {
    var wrap = document.querySelector('[data-carta-tabs-wrap]');
    var nav = document.getElementById('carta-tabs');
    if (!wrap || !nav) return;

    var prev = wrap.querySelector('[data-carta-scroll="prev"]');
    var next = wrap.querySelector('[data-carta-scroll="next"]');
    var step = function () { return Math.max(nav.clientWidth * 0.72, 120); };

    if (prev) {
      prev.addEventListener('click', function () {
        nav.scrollBy({ left: -step(), behavior: 'smooth' });
      });
    }

    if (next) {
      next.addEventListener('click', function () {
        nav.scrollBy({ left: step(), behavior: 'smooth' });
      });
    }

    nav.addEventListener('scroll', updateTabsScrollState, { passive: true });
    window.addEventListener('resize', updateTabsScrollState);
    window.addEventListener('orientationchange', function () {
      setTimeout(updateTabsScrollState, 150);
    });
    updateTabsScrollState();
  }

  function initNeonPulse() {
    var searchSvg = document.querySelector('.carta-search-icon__svg');
    var sectionsBtn = document.getElementById('carta-sections-btn');
    var sectionsIcon = sectionsBtn ? sectionsBtn.querySelector('.carta-sections-btn__icon') : null;
    var targets = [searchSvg, sectionsBtn, sectionsIcon].filter(Boolean);
    if (!targets.length) return;

    var phases = ['carta-neon-p0', 'carta-neon-p1', 'carta-neon-p2'];
    var index = 0;

    function setPhase(i) {
      var sheetOpen = sectionsBtn && sectionsBtn.getAttribute('aria-expanded') === 'true';
      targets.forEach(function (el) {
        if (sheetOpen && (el === sectionsBtn || el === sectionsIcon)) return;
        phases.forEach(function (cls) { el.classList.remove(cls); });
        el.classList.add(phases[i]);
      });
    }

    setPhase(0);
    setInterval(function () {
      if (sectionsBtn && sectionsBtn.getAttribute('aria-expanded') === 'true') return;
      index = (index + 1) % phases.length;
      setPhase(index);
    }, 750);
  }

  function initSectionSheet(setActiveFn) {
    var sheet = document.getElementById('carta-sections-sheet');
    var openBtn = document.getElementById('carta-sections-btn');
    var list = document.getElementById('carta-sections-list');
    var scrollLockY = 0;
    if (!sheet || !openBtn) return;

    function lockScroll() {
      scrollLockY = window.scrollY || window.pageYOffset || 0;
      document.documentElement.classList.add('carta-sheet-open');
      document.body.classList.add('carta-sheet-open');
      document.body.style.position = 'fixed';
      document.body.style.top = '-' + scrollLockY + 'px';
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';
    }

    function unlockScroll() {
      document.documentElement.classList.remove('carta-sheet-open');
      document.body.classList.remove('carta-sheet-open');
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = '';
      window.scrollTo(0, scrollLockY);
    }

    function openSheet() {
      sheet.hidden = false;
      sheet.setAttribute('aria-hidden', 'false');
      openBtn.setAttribute('aria-expanded', 'true');
      lockScroll();
      requestAnimationFrame(function () {
        var activeItem = list && list.querySelector('.carta-sheet__item--active');
        if (activeItem) activeItem.scrollIntoView({ block: 'nearest' });
      });
      var closeBtn = sheet.querySelector('.carta-sheet__close');
      if (closeBtn) closeBtn.focus();
    }

    function closeSheet() {
      sheet.hidden = true;
      sheet.setAttribute('aria-hidden', 'true');
      openBtn.setAttribute('aria-expanded', 'false');
      unlockScroll();
      openBtn.focus();
    }

    openBtn.addEventListener('click', openSheet);

    sheet.querySelectorAll('[data-carta-sheet-close]').forEach(function (el) {
      el.addEventListener('click', closeSheet);
    });

    if (list) {
      list.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-carta-sheet-tab]');
        if (!btn) return;
        setActiveFn(btn.getAttribute('data-carta-sheet-tab'), true);
        closeSheet();
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !sheet.hidden) closeSheet();
    });
  }

  function init() {
    var config = window.MENU;
    if (!config) {
      showCartaError('No se pudo cargar el menú. Abre la carta desde http://localhost:8080/carta.html (usa ABRIR-CARTA.bat).');
      return;
    }

    if (!config.tabs || !config.tabs.length) {
      showCartaError('El menú no tiene categorías configuradas.');
      return;
    }

    applyTheme();

    var tabs = config.tabs;
    var items = config.items;
    var active = tabs[0].id;
    var search = document.getElementById('carta-search');
    var tabsNav = document.getElementById('carta-tabs');

    function setActive(id, scrollToProducts) {
      active = id;
      refresh();
      if (scrollToProducts) {
        var sticky = document.querySelector('.carta-sticky-tools');
        var listEl = document.getElementById('carta-list');
        if (listEl) {
          var top = listEl.getBoundingClientRect().top + window.scrollY;
          var offset = sticky ? sticky.offsetHeight + 12 : 12;
          var header = document.querySelector('.carta-header');
          if (header) offset += header.offsetHeight;
          window.scrollTo({ top: Math.max(0, top - offset), behavior: 'smooth' });
        }
      }
    }

    function refresh() {
      var query = search ? search.value : '';
      renderTabs(tabs, active);
      renderSectionsSheet(tabs, active);
      renderItems(items, active, query);
      updateSearchUI(query);
      requestAnimationFrame(function () {
        scrollActiveTabIntoView();
        updateTabsScrollState();
      });
    }

    if (tabsNav) {
      tabsNav.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-carta-tab]');
        if (!btn) return;
        setActive(btn.getAttribute('data-carta-tab'));
      });
    }

    if (search) {
      search.addEventListener('input', function () {
        renderItems(items, active, search.value);
        updateSearchUI(search.value);
      });
    }

    var wa = document.getElementById('carta-wa');
    if (wa) wa.setAttribute('href', WA_URL);

    initTabsScroll();
    initSectionSheet(setActive);
    initNeonPulse();

    if (window.AOImages) AOImages.initImages(document);
    refresh();
    document.documentElement.classList.remove('no-js');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
