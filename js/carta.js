(function () {
  'use strict';

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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
    if (back) {
      back.setAttribute('href', 'index.html#inicio');
      back.className = 'carta-back carta-back--hero font-lato';
    }

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
      brand.className = 'carta-logo carta-logo--hero';
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

  var ALL_SECTIONS_ID = '__all__';
  var itemRegistry = {};
  var itemAnimIndex = 0;
  var scrollLockY = 0;
  var scrollLockDepth = 0;

  function lockPageScroll() {
    if (scrollLockDepth === 0) {
      scrollLockY = window.scrollY || window.pageYOffset || 0;
      document.documentElement.classList.add('carta-modal-open');
      document.body.classList.add('carta-modal-open');
      document.body.style.position = 'fixed';
      document.body.style.top = '-' + scrollLockY + 'px';
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';
    }
    scrollLockDepth += 1;
  }

  function unlockPageScroll() {
    if (scrollLockDepth <= 0) return;
    scrollLockDepth -= 1;
    if (scrollLockDepth > 0) return;
    document.documentElement.classList.remove('carta-modal-open');
    document.body.classList.remove('carta-modal-open');
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    window.scrollTo(0, scrollLockY);
  }

  function matchesQuery(item, query) {
    var hay = (item.name + ' ' + item.desc + ' ' + (item.tags || []).join(' ')).toLowerCase();
    return hay.indexOf(query) !== -1;
  }

  function itemShowsPrice(item) {
    var price = String(item && item.price != null ? item.price : '').trim();
    if (!price) return false;
    var digits = price.replace(/[^\d]/g, '');
    return digits !== '' && parseInt(digits, 10) > 0;
  }

  function renderItemCard(item, sectionLabel) {
    var key = 'k' + (itemAnimIndex++);
    itemRegistry[key] = { item: item, section: sectionLabel || '' };
    var delay = Math.min((itemAnimIndex - 1) * 0.022, 0.52);
    var name = escapeHtml(item.name);
    var desc = escapeHtml(item.desc);
    var img = escapeHtml(item.img);
    var footPrice = itemShowsPrice(item)
      ? '<span class="carta-item__price">' + escapeHtml(item.price) + '</span>'
      : '<span class="carta-item__request font-lato">Solicitar al garzón</span>';
    return (
      '<article class="carta-item carta-item--reveal card-hover" data-carta-item-key="' + key + '" ' +
        'role="button" tabindex="0" aria-label="Ver ' + name + '" ' +
        'style="--carta-reveal-delay:' + delay + 's">' +
        '<div class="carta-item__img-wrap neon-border">' +
          '<img class="site-img-motion" data-img="' + img + '" alt="' + name + '" loading="lazy" decoding="async" width="88" height="88">' +
        '</div>' +
        '<div class="carta-item__body">' +
          '<h3 class="carta-item__title font-outfit">' + name + '</h3>' +
          '<p class="carta-item__desc font-lato">' + desc + '</p>' +
          '<div class="carta-item__foot">' +
            footPrice +
            (item.tags && item.tags.length ? '<span class="carta-item__tags font-lato">' + item.tags.slice(0, 2).map(function (t) {
              return '<span class="carta-item__tag">' + escapeHtml(t) + '</span>';
            }).join('') + '</span>' : '') +
          '</div>' +
          '<span class="carta-item__tap font-lato" aria-hidden="true">Ver detalle</span>' +
        '</div>' +
      '</article>'
    );
  }

  function renderTabs(tabs, active) {
    var nav = document.getElementById('carta-tabs');
    if (!nav) return;
    var showAll = active === null || active === ALL_SECTIONS_ID;
    var html = (
      '<button type="button" role="tab" aria-selected="' + showAll + '" ' +
      'data-carta-tab="' + ALL_SECTIONS_ID + '" ' +
      'class="carta-tab' + (showAll ? ' carta-tab--active' : '') + '" ' +
      'title="Ver carta completa">Todos</button>'
    );
    html += tabs.map(function (t) {
      var on = t.id === active;
      var label = escapeHtml(t.label);
      return (
        '<button type="button" role="tab" aria-selected="' + on + '" ' +
        'data-carta-tab="' + escapeHtml(t.id) + '" ' +
        'class="carta-tab' + (on ? ' carta-tab--active' : '') + '">' +
        label + '</button>'
      );
    }).join('');
    nav.innerHTML = html;
  }

  function renderSectionsSheet(tabs, active) {
    var list = document.getElementById('carta-sections-list');
    if (!list) return;
    var showAll = active === null || active === ALL_SECTIONS_ID;
    var html = (
      '<li class="carta-sheet__item-wrap">' +
        '<button type="button" class="carta-sheet__item' + (showAll ? ' carta-sheet__item--active' : '') + '" ' +
        'data-carta-sheet-tab="' + ALL_SECTIONS_ID + '">' +
          '<span class="carta-sheet__item-num">★</span>' +
          '<span class="carta-sheet__item-label">Ver carta completa</span>' +
        '</button>' +
      '</li>'
    );
    html += tabs.map(function (t, i) {
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
    list.innerHTML = html;
  }

  function renderItems(items, tabs, category, query) {
    var list = document.getElementById('carta-list');
    if (!list) return;

    itemRegistry = {};
    itemAnimIndex = 0;

    var q = (query || '').trim().toLowerCase();
    var parts = [];
    var hasResults = false;

    if (q) {
      tabs.forEach(function (tab) {
        var catItems = (items[tab.id] || []).filter(function (item) { return matchesQuery(item, q); });
        if (!catItems.length) return;
        hasResults = true;
        parts.push(
          '<section class="carta-section" id="carta-' + escapeHtml(tab.id) + '">' +
            '<h2 class="carta-section__title font-outfit">' + escapeHtml(tab.label) + '</h2>' +
            '<div class="carta-section__items">' + catItems.map(function (item) {
              return renderItemCard(item, tab.label);
            }).join('') + '</div>' +
          '</section>'
        );
      });
    } else if (category === null || category === ALL_SECTIONS_ID) {
      tabs.forEach(function (tab) {
        var catItems = items[tab.id] || [];
        if (!catItems.length) return;
        hasResults = true;
        parts.push(
          '<section class="carta-section" id="carta-' + escapeHtml(tab.id) + '">' +
            '<h2 class="carta-section__title font-outfit">' + escapeHtml(tab.label) + '</h2>' +
            '<div class="carta-section__items">' + catItems.map(function (item) {
              return renderItemCard(item, tab.label);
            }).join('') + '</div>' +
          '</section>'
        );
      });
    } else {
      var single = items[category] || [];
      if (single.length) {
        hasResults = true;
        parts.push('<div class="carta-section__items">' + single.map(function (item) {
          var tab = tabs.filter(function (t) { return t.id === category; })[0];
          return renderItemCard(item, tab ? tab.label : '');
        }).join('') + '</div>');
      }
    }

    if (!hasResults) {
      list.innerHTML = '<p class="carta-empty font-lato">' +
        (q ? 'No encontramos platos con ese filtro.' : 'No hay productos en esta sección.') +
        '</p>';
      return;
    }

    list.innerHTML = parts.join('');
    list.classList.remove('carta-list--in');
    void list.offsetWidth;
    list.classList.add('carta-list--in');
    if (window.AOImages) AOImages.initImages(list);
  }

  function getStickyOffset() {
    var sticky = document.querySelector('.carta-sticky-tools');
    return (sticky ? sticky.offsetHeight : 0) + 12;
  }

  function scrollToSection(sectionId) {
    var target = document.getElementById('carta-' + sectionId);
    if (!target) return;
    var top = target.getBoundingClientRect().top + window.scrollY - getStickyOffset();
    var coarse = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    window.scrollTo({ top: Math.max(0, top), behavior: coarse ? 'auto' : 'smooth' });
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
    var navRect = nav.getBoundingClientRect();
    var btnRect = activeBtn.getBoundingClientRect();
    var targetLeft = nav.scrollLeft + (btnRect.left - navRect.left) - (navRect.width / 2) + (btnRect.width / 2);
    targetLeft = Math.max(0, Math.min(targetLeft, nav.scrollWidth - nav.clientWidth));
    var coarse = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    if (!coarse && nav.scrollTo) {
      nav.scrollTo({ left: targetLeft, behavior: 'smooth' });
    } else {
      nav.scrollLeft = targetLeft;
    }
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
      var productModal = document.getElementById('carta-product-modal');
      var productOpen = productModal && !productModal.hidden;
      targets.forEach(function (el) {
        if ((sheetOpen || productOpen) && (el === sectionsBtn || el === sectionsIcon)) return;
        phases.forEach(function (cls) { el.classList.remove(cls); });
        el.classList.add(phases[i]);
      });
    }

    setPhase(0);
    setInterval(function () {
      if (sectionsBtn && sectionsBtn.getAttribute('aria-expanded') === 'true') return;
      var productModal = document.getElementById('carta-product-modal');
      if (productModal && !productModal.hidden) return;
      index = (index + 1) % phases.length;
      setPhase(index);
    }, 750);
  }

  function initProductModal() {
    var modal = document.getElementById('carta-product-modal');
    var list = document.getElementById('carta-list');
    if (!modal || !list) return;

    var imgEl = document.getElementById('carta-product-img');
    var sectionEl = document.getElementById('carta-product-section');
    var titleEl = document.getElementById('carta-product-title');
    var descEl = document.getElementById('carta-product-desc');
    var priceEl = document.getElementById('carta-product-price');
    var tagsEl = document.getElementById('carta-product-tags');
    var lastFocus = null;

    function openProduct(entry) {
      if (!entry || !entry.item) return;
      var item = entry.item;
      lastFocus = document.activeElement;

      if (sectionEl) {
        sectionEl.textContent = entry.section || '';
        sectionEl.hidden = !entry.section;
      }
      if (titleEl) titleEl.textContent = item.name;
      if (descEl) descEl.textContent = item.desc || 'Consulta con tu garzón';
      if (priceEl) {
        if (itemShowsPrice(item)) {
          priceEl.textContent = item.price;
          priceEl.hidden = false;
          priceEl.classList.remove('carta-product-modal__price--request');
        } else {
          priceEl.textContent = 'Solicitar al garzón';
          priceEl.hidden = false;
          priceEl.classList.add('carta-product-modal__price--request');
        }
      }
      if (tagsEl) {
        tagsEl.innerHTML = (item.tags || []).map(function (t) {
          return '<span class="carta-item__tag">' + escapeHtml(t) + '</span>';
        }).join('');
        tagsEl.hidden = !(item.tags && item.tags.length);
      }
      if (imgEl) {
        imgEl.alt = item.name;
        imgEl.setAttribute('data-img', item.img || '');
        imgEl.src = window.AOImages ? AOImages.PLACEHOLDER : '';
      }

      modal.hidden = false;
      modal.setAttribute('aria-hidden', 'false');
      modal.classList.remove('is-closing');
      lockPageScroll();

      if (window.AOImages && imgEl) AOImages.initImages(modal);

      requestAnimationFrame(function () {
        modal.classList.add('is-open');
        var closeBtn = modal.querySelector('.carta-product-modal__close');
        if (closeBtn) closeBtn.focus();
      });
    }

    function closeProduct() {
      if (modal.hidden) return;
      modal.classList.remove('is-open');
      modal.classList.add('is-closing');

      setTimeout(function () {
        modal.hidden = true;
        modal.setAttribute('aria-hidden', 'true');
        modal.classList.remove('is-closing');
        unlockPageScroll();
        if (lastFocus && lastFocus.focus) lastFocus.focus();
      }, 260);
    }

    function openFromCard(card) {
      var key = card.getAttribute('data-carta-item-key');
      if (!key || !itemRegistry[key]) return;
      openProduct(itemRegistry[key]);
    }

    list.addEventListener('click', function (e) {
      var card = e.target.closest('[data-carta-item-key]');
      if (!card) return;
      openFromCard(card);
    });

    list.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var card = e.target.closest('[data-carta-item-key]');
      if (!card) return;
      e.preventDefault();
      openFromCard(card);
    });

    modal.querySelectorAll('[data-carta-product-close]').forEach(function (el) {
      el.addEventListener('click', closeProduct);
    });

    window.__cartaCloseProduct = closeProduct;
    window.__cartaProductOpen = function () { return !modal.hidden; };
  }

  function initClickCaret() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var layer = document.createElement('div');
    layer.className = 'carta-click-caret-layer';
    layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(layer);

    var activeCaret = null;
    var hideTimer = null;

    function modalOpen() {
      var productModal = document.getElementById('carta-product-modal');
      var sheet = document.getElementById('carta-sections-sheet');
      return (productModal && !productModal.hidden) || (sheet && !sheet.hidden);
    }

    function isBlocked(target) {
      if (!target) return true;
      if (modalOpen()) return true;
      return !!target.closest('input, textarea, select');
    }

    function hideCaret(caret) {
      if (caret && caret.parentNode) caret.parentNode.removeChild(caret);
      if (activeCaret === caret) activeCaret = null;
    }

    function showCaret(clientX, clientY) {
      if (activeCaret) hideCaret(activeCaret);
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }

      var pad = 6;
      var x = Math.max(pad, Math.min(clientX, window.innerWidth - pad));
      var y = Math.max(pad, Math.min(clientY, window.innerHeight - pad));

      var caret = document.createElement('span');
      caret.className = 'carta-click-caret';
      caret.style.left = x + 'px';
      caret.style.top = y + 'px';
      layer.appendChild(caret);
      activeCaret = caret;

      hideTimer = setTimeout(function () {
        caret.classList.add('is-fading');
        setTimeout(function () { hideCaret(caret); }, 380);
      }, 2200);
    }

    document.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      if (isBlocked(e.target)) return;
      showCaret(e.clientX, e.clientY);
    });
  }

  function initSectionSheet(setActiveFn) {
    var sheet = document.getElementById('carta-sections-sheet');
    var openBtn = document.getElementById('carta-sections-btn');
    var list = document.getElementById('carta-sections-list');
    if (!sheet || !openBtn) return;

    function openSheet() {
      sheet.hidden = false;
      sheet.setAttribute('aria-hidden', 'false');
      openBtn.setAttribute('aria-expanded', 'true');
      lockPageScroll();
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
      unlockPageScroll();
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
        setActiveFn(btn.getAttribute('data-carta-sheet-tab'), btn.getAttribute('data-carta-sheet-tab') !== ALL_SECTIONS_ID);
        closeSheet();
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (window.__cartaProductOpen && window.__cartaProductOpen()) {
        window.__cartaCloseProduct();
        return;
      }
      if (!sheet.hidden) closeSheet();
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
    var active = null;
    var search = document.getElementById('carta-search');
    var tabsNav = document.getElementById('carta-tabs');

    function normalizeCategory(id) {
      return id === ALL_SECTIONS_ID ? null : id;
    }

    function setActive(id, scrollToList) {
      active = normalizeCategory(id);
      refresh();
      if (!scrollToList) return;
      requestAnimationFrame(function () {
        if (active) {
          var section = document.getElementById('carta-' + active);
          if (section) {
            scrollToSection(active);
            return;
          }
        }
        var listEl = document.getElementById('carta-list');
        if (listEl) {
          var top = listEl.getBoundingClientRect().top + window.scrollY - getStickyOffset();
          window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
        }
      });
    }

    function refresh() {
      var query = search ? search.value : '';
      renderTabs(tabs, active);
      renderSectionsSheet(tabs, active);
      renderItems(items, tabs, active, query);
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
        var id = btn.getAttribute('data-carta-tab');
        if (id === ALL_SECTIONS_ID) {
          setActive(null);
          return;
        }
        setActive(id, false);
      });
    }

    if (search) {
      search.addEventListener('input', function () {
        renderItems(items, tabs, active, search.value);
        updateSearchUI(search.value);
      });
    }

    initTabsScroll();
    initSectionSheet(setActive);
    initProductModal();
    initClickCaret();
    initNeonPulse();

    document.body.classList.add('carta-page-ready');

    if (window.AOImages) AOImages.initImages(document);
    refresh();
    document.documentElement.classList.remove('no-js');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
