(function () {
  'use strict';

  var WA_URL = 'https://wa.me/56993015918?text=' + encodeURIComponent('Hola, estoy en mesa y quisiera hacer un pedido en After Office Resto-Bar');

  var activeSection = '';
  var sectionObserver = null;
  var jumpLock = false;
  var jumpTimer = null;
  var cartaTabs = [];

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

  function matchesQuery(item, query) {
    var hay = (item.name + ' ' + item.desc + ' ' + (item.tags || []).join(' ')).toLowerCase();
    return hay.indexOf(query) !== -1;
  }

  function renderItemCard(item) {
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
  }

  function renderTabs(tabs, active) {
    var nav = document.getElementById('carta-tabs');
    if (!nav) return;
    nav.innerHTML = tabs.map(function (t) {
      var on = t.id === active;
      var label = escapeHtml(shortLabel(t.label, 18));
      var full = escapeHtml(t.label);
      return (
        '<button type="button" data-carta-jump="' + escapeHtml(t.id) + '" ' +
        'class="carta-tab' + (on ? ' carta-tab--active' : '') + '" ' +
        'title="' + full + '">' + label + '</button>'
      );
    }).join('');
  }

  function setActiveSection(id, scrollTab) {
    if (!id || activeSection === id) return;
    activeSection = id;
    renderTabs(cartaTabs, id);
    if (scrollTab) {
      requestAnimationFrame(function () {
        scrollActiveTabIntoView();
      });
    }
  }

  function renderFullMenu(tabs, items, query) {
    var list = document.getElementById('carta-list');
    if (!list) return;

    var q = (query || '').trim().toLowerCase();
    var parts = [];
    var hasResults = false;

    tabs.forEach(function (tab) {
      var catItems = items[tab.id] || [];
      if (q) {
        catItems = catItems.filter(function (item) { return matchesQuery(item, q); });
      }
      if (!catItems.length) return;

      hasResults = true;
      parts.push(
        '<section id="carta-' + escapeHtml(tab.id) + '" class="carta-section" data-carta-section="' + escapeHtml(tab.id) + '">' +
          '<h2 class="carta-section__title font-outfit">' + escapeHtml(tab.label) + '</h2>' +
          '<div class="carta-section__items">' +
            catItems.map(renderItemCard).join('') +
          '</div>' +
        '</section>'
      );
    });

    if (!hasResults) {
      list.innerHTML = '<p class="carta-empty font-lato">' +
        (q ? 'No encontramos platos con ese filtro.' : 'No hay productos en la carta.') +
        '</p>';
      disconnectSectionObserver();
      return;
    }

    list.innerHTML = parts.join('');
    if (window.AOImages) AOImages.initImages(list);
    initSectionObserver(tabs);
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

  function disconnectSectionObserver() {
    if (sectionObserver) {
      sectionObserver.disconnect();
      sectionObserver = null;
    }
  }

  function initSectionObserver(tabs) {
    disconnectSectionObserver();

    var sections = document.querySelectorAll('[data-carta-section]');
    if (!sections.length) return;

    if (!activeSection || !document.getElementById('carta-' + activeSection)) {
      activeSection = tabs[0] ? tabs[0].id : '';
      renderTabs(tabs, activeSection);
    }

    sectionObserver = new IntersectionObserver(function (entries) {
      if (jumpLock) return;

      var visible = entries
        .filter(function (e) { return e.isIntersecting; })
        .sort(function (a, b) { return b.intersectionRatio - a.intersectionRatio; });

      if (!visible.length) return;
      var id = visible[0].target.getAttribute('data-carta-section');
      if (id) setActiveSection(id, true);
    }, {
      root: null,
      rootMargin: '-11rem 0px -55% 0px',
      threshold: [0, 0.15, 0.35, 0.6]
    });

    sections.forEach(function (section) {
      sectionObserver.observe(section);
    });
  }

  function jumpToSection(id) {
    var target = document.getElementById('carta-' + id);
    if (!target) return;

    jumpLock = true;
    if (jumpTimer) clearTimeout(jumpTimer);

    setActiveSection(id, true);
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });

    jumpTimer = setTimeout(function () {
      jumpLock = false;
    }, 700);
  }

  function updateNavHint(query, tabs) {
    var hint = document.getElementById('carta-nav-hint');
    if (!hint) return;

    if ((query || '').trim()) {
      hint.textContent = 'Resultados en todas las secciones';
      return;
    }

    hint.textContent = tabs.length + ' secciones · desliza y toca para ir directo';
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
    var search = document.getElementById('carta-search');
    var tabsNav = document.getElementById('carta-tabs');

    cartaTabs = tabs;
    activeSection = tabs[0].id;

    function refresh() {
      var query = search ? search.value : '';
      renderFullMenu(tabs, items, query);
      updateNavHint(query, tabs);
      requestAnimationFrame(updateTabsScrollState);
    }

    if (tabsNav) {
      tabsNav.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-carta-jump]');
        if (!btn) return;
        jumpToSection(btn.getAttribute('data-carta-jump'));
      });
    }

    if (search) {
      search.addEventListener('input', function () {
        activeSection = tabs[0].id;
        refresh();
      });
    }

    var wa = document.getElementById('carta-wa');
    if (wa) wa.setAttribute('href', WA_URL);

    initTabsScroll();
    renderTabs(tabs, activeSection);

    if (window.AOImages) AOImages.initImages(document);
    refresh();
    document.documentElement.classList.remove('no-js');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
