(function () {
  'use strict';

  var DEMOS = ['demo-1', 'demo-2', 'demo-3'];
  var loadedPanels = { 'demo-1': false };

  function createIcons() {
    if (window.lucide && window.lucide.createIcons) {
      window.lucide.createIcons();
    }
  }

  function deferPanelMedia(panel) {
    if (!panel || panel.dataset.mediaDeferred === 'true') return;
    panel.querySelectorAll('img[src]').forEach(function (img) {
      if (img.closest('#d1-hero')) return;
      if (!img.dataset.src) {
        img.dataset.src = img.getAttribute('src');
        img.removeAttribute('src');
      }
    });
    panel.querySelectorAll('iframe[data-src]').forEach(function (frame) {
      if (!frame.getAttribute('src') || frame.getAttribute('src') === 'about:blank') return;
      frame.dataset.src = frame.getAttribute('src');
      frame.setAttribute('src', 'about:blank');
    });
    panel.dataset.mediaDeferred = 'true';
  }

  function activatePanelMedia(panel) {
    if (!panel || loadedPanels[panel.id]) return;
    panel.querySelectorAll('img[data-src]').forEach(function (img) {
      img.setAttribute('src', img.dataset.src);
      img.removeAttribute('data-src');
      if (!img.hasAttribute('loading')) img.setAttribute('loading', 'lazy');
      if (!img.hasAttribute('decoding')) img.setAttribute('decoding', 'async');
    });
    loadedPanels[panel.id] = true;
  }

  function loadMap(frame) {
    if (!frame.dataset.src || frame.dataset.mapLoaded === 'true') return;
    frame.setAttribute('src', frame.dataset.src);
    frame.dataset.mapLoaded = 'true';
  }

  function initLazyMaps() {
    var maps = document.querySelectorAll('iframe.demo-map[data-src]');
    if (!maps.length) return;

    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            loadMap(entry.target);
            observer.unobserve(entry.target);
          }
        });
      }, { rootMargin: '200px 0px' });
      maps.forEach(function (frame) { observer.observe(frame); });
    } else {
      maps.forEach(loadMap);
    }
  }

  function loadMapsInPanel(panel) {
    if (!panel) return;
    panel.querySelectorAll('iframe.demo-map[data-src]').forEach(loadMap);
  }

  function showDemo(id) {
    DEMOS.forEach(function (demoId) {
      var panel = document.getElementById(demoId);
      if (!panel) return;
      var show = demoId === id;
      panel.classList.toggle('hidden', !show);
      panel.setAttribute('aria-hidden', show ? 'false' : 'true');
      if (show) {
        activatePanelMedia(panel);
        loadMapsInPanel(panel);
      }
    });

    document.querySelectorAll('[data-demo-tab]').forEach(function (tab) {
      var active = tab.getAttribute('data-demo-tab') === id;
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
      tab.classList.toggle('opacity-100', active);
      tab.classList.toggle('opacity-70', !active);
      tab.classList.toggle('ring-2', active);
      tab.classList.toggle('sm:ring-offset-2', active);
      tab.classList.toggle('ring-offset-neutral-900', active);
    });

    createIcons();
    initLazyMaps();
  }

  function initSwitcher() {
    document.querySelectorAll('[data-demo-tab]').forEach(function (tab) {
      tab.addEventListener('click', function () {
        var id = tab.getAttribute('data-demo-tab');
        showDemo(id);
        try { history.replaceState(null, '', '#' + id); } catch (e) { /* file:// */ }
      });
    });
    var hash = (location.hash || '').replace('#', '');
    showDemo(DEMOS.includes(hash) ? hash : 'demo-1');
  }

  function initSwitcherOffset() {
    var switcher = document.getElementById('demo-switcher');
    if (!switcher) return;
    function update() {
      document.documentElement.style.setProperty('--switcher-h', switcher.offsetHeight + 'px');
    }
    update();
    window.addEventListener('resize', update, { passive: true });
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(update).observe(switcher);
    }
  }

  function initDeferredDemos() {
    deferPanelMedia(document.getElementById('demo-2'));
    deferPanelMedia(document.getElementById('demo-3'));
    document.querySelectorAll('#demo-1 img[src]').forEach(function (img) {
      if (img.closest('#d1-hero')) return;
      img.setAttribute('loading', 'lazy');
      img.setAttribute('decoding', 'async');
    });
  }

  function initMobileNav() {
    document.querySelectorAll('[data-mobile-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var menu = document.getElementById(btn.getAttribute('data-mobile-toggle'));
        if (menu) menu.classList.toggle('hidden');
      });
    });
    document.querySelectorAll('[id$="-mobile-menu"] a').forEach(function (link) {
      link.addEventListener('click', function () {
        var menu = link.closest('[id$="-mobile-menu"]');
        if (menu) menu.classList.add('hidden');
      });
    });
  }

  function initForms() {
    document.querySelectorAll('[data-reservation-form]').forEach(function (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var toast = form.querySelector('[data-reservation-toast]');
        var btn = form.querySelector('button[type="submit"]');
        if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }
        setTimeout(function () {
          if (toast) {
            toast.classList.remove('hidden');
            setTimeout(function () { toast.classList.add('hidden'); }, 5000);
          }
          form.reset();
          if (btn) {
            btn.disabled = false;
            btn.textContent = btn.getAttribute('data-label') || 'Confirmar reserva';
          }
        }, 900);
      });
    });
  }

  document.documentElement.classList.remove('no-js');
  document.addEventListener('DOMContentLoaded', function () {
    initSwitcherOffset();
    initDeferredDemos();
    initSwitcher();
    initMobileNav();
    initForms();
    initLazyMaps();
    if (typeof initDemo1Menu === 'function') initDemo1Menu();
    if (typeof initDemo3BeerBoard === 'function') initDemo3BeerBoard();
    createIcons();
  });
})();
