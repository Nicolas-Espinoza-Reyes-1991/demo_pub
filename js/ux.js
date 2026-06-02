(function (global) {
  'use strict';

  var WA = 'https://wa.me/56993015918?text=' + encodeURIComponent('Hola, quiero reservar en After Office Resto-Bar, Futrono');

  var DEMOS = {
    'demo-1': { theme: 'classic', reserve: '#d1-reserve', carta: 'carta.html?demo=1', cartaLabel: 'Menú' },
    'demo-2': { theme: 'neon', reserve: '#d2-reserve', carta: 'carta.html?demo=2', cartaLabel: 'Nocturno' },
    'demo-3': { theme: 'industrial', reserve: '#d3-reserve', carta: 'carta.html?demo=3', cartaLabel: 'Carta' }
  };

  var currentDemo = 'demo-1';

  function isOpenNow() {
    var now = new Date();
    var day = now.getDay();
    var h = now.getHours() + now.getMinutes() / 60;
    if (day === 0) return false;
    return h >= 17 || h < 2;
  }

  function initReveal() {
    var els = document.querySelectorAll('.reveal');
    if (!els.length) return;
    if (!('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('is-visible');
          obs.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    els.forEach(function (el) { obs.observe(el); });
  }

  function autoRevealSections() {
    document.querySelectorAll('.demo-panel section').forEach(function (sec, i) {
      if (sec.id && sec.id.indexOf('hero') !== -1) return;
      if (sec.classList.contains('trust-bar')) return;
      sec.classList.add('reveal');
      if (i % 3 === 1) sec.classList.add('reveal-delay-1');
    });
  }

  function updateMobileBar(demoId) {
    var bar = document.getElementById('mobile-cta-bar');
    if (!bar) return;
    var cfg = DEMOS[demoId] || DEMOS['demo-1'];
    currentDemo = demoId;
    bar.className = 'mobile-cta-bar mobile-cta-bar--' + cfg.theme;
    var reserve = bar.querySelector('[data-cta-reserve]');
    var carta = bar.querySelector('[data-cta-carta]');
    var wa = bar.querySelector('[data-cta-wa]');
    if (reserve) reserve.setAttribute('href', cfg.reserve);
    if (carta) {
      carta.setAttribute('href', cfg.carta);
      var label = carta.querySelector('[data-cta-carta-label]');
      if (label) label.textContent = cfg.cartaLabel || 'Menú';
    }
    if (wa) wa.setAttribute('href', WA);
  }

  function initMobileBar() {
    var bar = document.getElementById('mobile-cta-bar');
    if (!bar) return;
    document.body.classList.add('has-mobile-cta');
    updateMobileBar(currentDemo);

    var isMobile = window.matchMedia('(max-width: 767px)').matches;
    var hero = document.querySelector('.demo-panel:not(.hidden) [id$="-hero"]');
    function onScroll() {
      var threshold = isMobile ? 100 : (hero ? hero.offsetHeight * 0.35 : 280);
      var show = window.scrollY > threshold;
      bar.classList.toggle('is-visible', show);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function scrollSwitcherTab(demoId) {
    var track = document.querySelector('.demo-switcher__track');
    if (!track) return;
    var tab = track.querySelector('[data-demo-tab="' + demoId + '"]');
    if (tab && tab.scrollIntoView) {
      tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }

  function initMobileNavEnhance() {
    document.addEventListener('click', function (e) {
      if (!document.body.classList.contains('nav-open')) return;
      var t = e.target;
      if (t.closest('.mobile-nav') || t.closest('[data-mobile-toggle]')) return;
      document.querySelectorAll('.mobile-nav.is-open').forEach(function (menu) {
        menu.classList.remove('is-open');
      });
      document.querySelectorAll('[data-mobile-toggle]').forEach(function (btn) {
        btn.setAttribute('aria-expanded', 'false');
      });
      document.body.classList.remove('nav-open');
    });
  }

  function updateOpenBadges() {
    var open = isOpenNow();
    document.querySelectorAll('[data-open-badge]').forEach(function (badge) {
      var dot = badge.querySelector('.hero-badge__dot');
      var text = badge.querySelector('[data-open-text]');
      if (open) {
        badge.classList.add('hero-badge--pulse');
        if (text) text.textContent = 'Abierto ahora';
        if (dot) dot.style.background = '#22c55e';
      } else {
        badge.classList.remove('hero-badge--pulse');
        if (text) text.textContent = 'Reserva tu mesa';
        if (dot) dot.style.background = '#f59e0b';
      }
    });
  }

  function refreshRevealsForPanel(demoId) {
    var panel = document.getElementById(demoId);
    if (!panel) return;
    requestAnimationFrame(function () {
      panel.querySelectorAll('.reveal:not(.is-visible)').forEach(function (el) {
        var rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight * 0.9) el.classList.add('is-visible');
      });
    });
  }

  function onDemoChange(demoId) {
    updateMobileBar(demoId);
    refreshRevealsForPanel(demoId);
    scrollSwitcherTab(demoId);
    document.querySelectorAll('.mobile-nav.is-open').forEach(function (m) { m.classList.remove('is-open'); });
    document.querySelectorAll('[data-mobile-toggle]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
    document.body.classList.remove('nav-open');
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
  }

  function init() {
    autoRevealSections();
    initReveal();
    initMobileBar();
    initMobileNavEnhance();
    updateOpenBadges();
    setInterval(updateOpenBadges, 60000);

    document.addEventListener('demochange', function (e) {
      if (e.detail && e.detail.id) onDemoChange(e.detail.id);
    });

    var hash = (location.hash || '').replace('#', '');
    if (DEMOS[hash]) onDemoChange(hash);
  }

  global.AOUx = { onDemoChange: onDemoChange, init: init };

  document.addEventListener('DOMContentLoaded', init);
})(typeof window !== 'undefined' ? window : this);
