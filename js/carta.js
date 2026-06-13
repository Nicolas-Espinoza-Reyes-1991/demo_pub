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

  function renderCategorySelect(tabs, active) {
    var select = document.getElementById('carta-category');
    if (!select) return;
    select.innerHTML = tabs.map(function (t) {
      var sel = t.id === active ? ' selected' : '';
      return '<option value="' + escapeHtml(t.id) + '"' + sel + '>' + escapeHtml(t.label) + '</option>';
    }).join('');
    select.value = active;
  }

  function renderTabs(tabs, active) {
    var nav = document.getElementById('carta-tabs');
    if (!nav) return;
    nav.innerHTML = tabs.map(function (t) {
      var on = t.id === active;
      var label = escapeHtml(shortLabel(t.label, 18));
      var full = escapeHtml(t.label);
      return (
        '<button type="button" role="tab" aria-selected="' + on + '" ' +
        'data-carta-tab="' + escapeHtml(t.id) + '" ' +
        'class="carta-tab' + (on ? ' carta-tab--active' : '') + '" ' +
        'title="' + full + '">' + label + '</button>'
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
    var step = function () { return Math.max(nav.clientWidth * 0.72, 140); };

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
    updateTabsScrollState();
  }

  function updateNavHint(tabs, active, query) {
    var hint = document.getElementById('carta-nav-hint');
    if (!hint) return;

    if ((query || '').trim()) {
      hint.textContent = 'Buscando en todas las secciones';
      return;
    }

    var current = tabs.find(function (t) { return t.id === active; });
    var index = tabs.findIndex(function (t) { return t.id === active; });
    hint.textContent = (index + 1) + ' de ' + tabs.length + ' · ' + (current ? current.label : '');
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
    var categorySelect = document.getElementById('carta-category');

    function setActive(id) {
      active = id;
      refresh();
    }

    function refresh() {
      var query = search ? search.value : '';
      renderCategorySelect(tabs, active);
      renderTabs(tabs, active);
      renderItems(items, active, query);
      updateNavHint(tabs, active, query);
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

    if (categorySelect) {
      categorySelect.addEventListener('change', function () {
        setActive(categorySelect.value);
      });
    }

    if (search) {
      search.addEventListener('input', function () {
        renderItems(items, active, search.value);
        updateNavHint(tabs, active, search.value);
      });
    }

    var wa = document.getElementById('carta-wa');
    if (wa) wa.setAttribute('href', WA_URL);

    initTabsScroll();

    if (window.AOImages) AOImages.initImages(document);
    refresh();
    document.documentElement.classList.remove('no-js');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
