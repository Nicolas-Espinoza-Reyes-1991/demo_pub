(function () {
  'use strict';

  var WA_URL = 'https://wa.me/56993015918?text=' + encodeURIComponent('Hola, estoy en mesa y quisiera hacer un pedido en After Office Resto-Bar');

  var THEMES = {
    '1': {
      id: '1',
      name: 'Clásico',
      bodyClass: 'carta-page--classic',
      titleClass: 'font-playfair',
      backHref: 'index.html#demo-1',
      pageTitle: 'Nuestro Menú',
      subtitle: 'Coctelería · Cervezas · Burgers · Tablas',
      pill: 'Pide desde tu mesa'
    },
    '2': {
      id: '2',
      name: 'Neón',
      bodyClass: 'carta-page--neon',
      titleClass: 'font-outfit',
      backHref: 'index.html#demo-2',
      pageTitle: 'Menú Nocturno',
      subtitle: 'Cocteles UV · Shots · Comida nocturna',
      pill: 'Tragos, shots y más'
    },
    '3': {
      id: '3',
      name: 'Cervecería',
      bodyClass: 'carta-page--industrial',
      titleClass: 'font-oswald uppercase tracking-wide',
      backHref: 'index.html#demo-3',
      pageTitle: 'Carta del Pub',
      subtitle: 'Schops craft · Pub food · Tablas',
      pill: 'Schops y comida de pub'
    }
  };

  function getDemoId() {
    var p = new URLSearchParams(location.search);
    var d = p.get('demo') || p.get('d') || '1';
    return THEMES[d] ? d : '1';
  }

  function getMenuConfig(demoId) {
    if (!window.MENU_BY_DEMO || !MENU_BY_DEMO[demoId]) return null;
    return MENU_BY_DEMO[demoId];
  }

  function applyTheme(theme) {
    var body = document.body;
    body.classList.remove('carta-page--classic', 'carta-page--neon', 'carta-page--industrial');
    body.classList.remove('font-playfair', 'font-outfit', 'font-oswald');
    body.classList.add(theme.bodyClass);
    if (theme.id === '2') body.classList.add('font-outfit');
    else if (theme.id === '3') body.classList.add('font-oswald');
    else body.classList.add('font-playfair');

    var back = document.getElementById('carta-back');
    if (back) back.setAttribute('href', theme.backHref);

    var title = document.getElementById('carta-title');
    if (title) {
      title.className = theme.titleClass + ' text-2xl font-bold carta-title';
      title.textContent = theme.pageTitle || ('Menú · ' + theme.name);
    }

    var sub = document.getElementById('carta-subtitle');
    if (sub) sub.textContent = theme.subtitle;

    var brand = document.getElementById('carta-brand');
    if (brand) {
      brand.className = 'brand-wordmark brand-wordmark--sm text-center flex-1 brand-wordmark--' +
        (theme.id === '2' ? 'neon' : theme.id === '3' ? 'industrial' : 'classic');
    }

    var foot = document.getElementById('carta-foot-link');
    if (foot) foot.setAttribute('href', theme.backHref);

    document.title = (theme.pageTitle || 'Menú') + ' · After Office Futrono';

    var pill = document.getElementById('carta-pill');
    if (pill) pill.textContent = theme.pill || 'Pide desde tu mesa';

    document.documentElement.setAttribute('data-carta-demo', theme.id);
  }

  function renderTabs(tabs, active) {
    var nav = document.getElementById('carta-tabs');
    if (!nav) return;
    nav.innerHTML = tabs.map(function (t) {
      var on = t.id === active;
      return '<button type="button" role="tab" aria-selected="' + on + '" data-carta-tab="' + t.id + '" class="carta-tab' + (on ? ' carta-tab--active' : '') + '">' + t.label + '</button>';
    }).join('');
  }

  function renderItems(items, category, query, titleClass) {
    var list = document.getElementById('carta-list');
    if (!list) return;
    var catItems = items[category] || [];
    var q = (query || '').trim().toLowerCase();
    if (q) {
      catItems = catItems.filter(function (item) {
        var hay = (item.name + ' ' + item.desc + ' ' + (item.tags || []).join(' ')).toLowerCase();
        return hay.indexOf(q) !== -1;
      });
    }
    if (!catItems.length) {
      list.innerHTML = '<p class="carta-empty font-lato">No encontramos platos con ese filtro.</p>';
      return;
    }
    list.innerHTML = catItems.map(function (item) {
      return (
        '<article class="carta-item" data-name="' + item.name.toLowerCase() + '">' +
          '<div class="carta-item__img-wrap">' +
            '<img data-img="' + item.img + '" alt="' + item.name + '" loading="lazy" decoding="async" width="88" height="88">' +
          '</div>' +
          '<div class="carta-item__body">' +
            '<h3 class="carta-item__title ' + titleClass + '">' + item.name + '</h3>' +
            '<p class="carta-item__desc font-lato">' + item.desc + '</p>' +
            '<div class="carta-item__foot">' +
              '<span class="carta-item__price">' + item.price + '</span>' +
              (item.tags ? '<span class="carta-item__tags font-lato">' + item.tags.slice(0, 2).join(' · ') + '</span>' : '') +
            '</div>' +
          '</div>' +
        '</article>'
      );
    }).join('');
    if (window.AOImages) AOImages.initImages(list);
  }

  function init() {
    var demoId = getDemoId();
    var theme = THEMES[demoId];
    var config = getMenuConfig(demoId);
    if (!config) return;

    applyTheme(theme);

    var tabs = config.tabs;
    var items = config.items;
    var active = tabs[0].id;
    var search = document.getElementById('carta-search');
    var tabsNav = document.getElementById('carta-tabs');

    function refresh() {
      renderTabs(tabs, active);
      renderItems(items, active, search ? search.value : '', theme.titleClass);
    }

    if (tabsNav) {
      tabsNav.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-carta-tab]');
        if (!btn) return;
        active = btn.getAttribute('data-carta-tab');
        refresh();
      });
    }

    if (search) {
      search.addEventListener('input', function () { renderItems(items, active, search.value, theme.titleClass); });
    }

    var wa = document.getElementById('carta-wa');
    if (wa) wa.setAttribute('href', WA_URL);

    if (window.AOImages) AOImages.initImages(document);
    refresh();
    document.documentElement.classList.remove('no-js');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
