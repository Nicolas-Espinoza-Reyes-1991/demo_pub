(function () {
  'use strict';

  function createIcons() {
    if (window.AOIcons) window.AOIcons.createIcons();
  }

  function isOpenNow() {
    var now = new Date();
    var day = now.getDay();
    var h = now.getHours() + now.getMinutes() / 60;
    if (day === 0) return false;
    return h >= 17 || h < 2;
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
        if (dot) dot.style.background = '#d946ef';
      }
    });
  }

  function isCoarsePointer() {
    return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  }

  var lastUserScrollAt = 0;

  function markUserScroll() {
    lastUserScrollAt = Date.now();
  }

  function userRecentlyScrolled(withinMs) {
    return Date.now() - lastUserScrollAt < (withinMs || 180);
  }

  function initStickyOffsets() {
    var header = document.getElementById('site-header');
    var sectionNav = document.querySelector('.site-section-nav-wrap');
    if (!header) return;

    var resizeTimer = null;

    function update() {
      var headerH = header.offsetHeight;
      var navH = sectionNav ? sectionNav.offsetHeight : 0;
      document.documentElement.style.setProperty('--site-header-h', headerH + 'px');
      document.documentElement.style.setProperty('--site-section-nav-h', navH + 'px');
      document.documentElement.style.setProperty('--site-sticky-top', (headerH + navH) + 'px');
    }

    function scheduleUpdate() {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(update, 120);
    }

    update();
    window.addEventListener('resize', scheduleUpdate, { passive: true });
    if (typeof ResizeObserver !== 'undefined') {
      var ro = new ResizeObserver(scheduleUpdate);
      ro.observe(header);
      if (sectionNav) ro.observe(sectionNav);
    }
  }

  function initMobileNav() {
    document.querySelectorAll('[data-mobile-toggle]').forEach(function (btn) {
      var menu = document.getElementById(btn.getAttribute('data-mobile-toggle'));
      if (!menu) return;
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var willOpen = !menu.classList.contains('is-open');
        document.querySelectorAll('.mobile-nav.is-open').forEach(function (m) { m.classList.remove('is-open'); });
        document.querySelectorAll('[data-mobile-toggle]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
        menu.classList.toggle('is-open', willOpen);
        btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        document.body.classList.toggle('nav-open', willOpen);
      });
    });
    document.querySelectorAll('.mobile-nav a').forEach(function (link) {
      link.addEventListener('click', function () {
        var menu = link.closest('.mobile-nav');
        if (menu) menu.classList.remove('is-open');
        document.body.classList.remove('nav-open');
        document.querySelectorAll('[data-mobile-toggle]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
      });
    });
    document.addEventListener('click', function (e) {
      if (!document.body.classList.contains('nav-open')) return;
      if (e.target.closest('.mobile-nav') || e.target.closest('[data-mobile-toggle]')) return;
      document.querySelectorAll('.mobile-nav.is-open').forEach(function (m) { m.classList.remove('is-open'); });
      document.body.classList.remove('nav-open');
    });
  }

  function initMobileBar() {
    var bar = document.querySelector('.site-mobile-bar');
    if (!bar) return;
    if (bar.classList.contains('is-visible')) return;

    var hero = document.getElementById('inicio');
    var threshold = hero ? Math.min(hero.offsetHeight * 0.25, 120) : 100;

    function onScroll() {
      markUserScroll();
      bar.classList.toggle('is-visible', window.scrollY > threshold);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function scrollSectionNavToActive(link, smooth) {
    if (!link) return;
    var nav = link.closest('.site-section-nav');
    if (!nav) return;

    var navRect = nav.getBoundingClientRect();
    var linkRect = link.getBoundingClientRect();
    var targetLeft = nav.scrollLeft + (linkRect.left - navRect.left) - (navRect.width / 2) + (linkRect.width / 2);
    targetLeft = Math.max(0, Math.min(targetLeft, nav.scrollWidth - nav.clientWidth));

    if (smooth && nav.scrollTo && !isCoarsePointer()) {
      nav.scrollTo({ left: targetLeft, behavior: 'smooth' });
    } else {
      nav.scrollLeft = targetLeft;
    }
  }

  function initLazyMap() {
    var frame = document.querySelector('iframe.demo-map[data-src]');
    if (!frame) return;
    if ('IntersectionObserver' in window) {
      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            frame.setAttribute('src', frame.dataset.src);
            obs.unobserve(frame);
          }
        });
      }, { rootMargin: '200px' });
      obs.observe(frame);
    } else {
      frame.setAttribute('src', frame.dataset.src);
    }
  }

  function initReveal() {
    var els = document.querySelectorAll('.reveal-site');
    if (!els.length || !('IntersectionObserver' in window)) {
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
    }, { threshold: 0.08, rootMargin: '0px 0px -24px 0px' });
    els.forEach(function (el) { obs.observe(el); });
  }

  function initHashScroll() {
    var hash = (location.hash || '').replace('#', '');
    if (!hash) return;
    var el = document.getElementById(hash);
    if (!el) return;
    requestAnimationFrame(function () {
      setTimeout(function () {
        el.scrollIntoView({
          behavior: isCoarsePointer() ? 'auto' : 'smooth',
          block: 'start'
        });
      }, 150);
    });
  }

  function initSectionNav() {
    var links = document.querySelectorAll('[data-section-nav]');
    if (!links.length) return;

    var navScrollRaf = null;
    var pendingNavLink = null;

    function queueNavScroll(link) {
      pendingNavLink = link;
      if (navScrollRaf) return;
      navScrollRaf = requestAnimationFrame(function () {
        navScrollRaf = null;
        if (pendingNavLink) scrollSectionNavToActive(pendingNavLink, false);
        pendingNavLink = null;
      });
    }

    links.forEach(function (link) {
      link.addEventListener('click', function () {
        setTimeout(function () {
          scrollSectionNavToActive(link, !isCoarsePointer());
        }, 80);
      });
    });

    var sections = [];
    links.forEach(function (link) {
      var id = (link.getAttribute('href') || '').replace('#', '');
      var sec = document.getElementById(id);
      if (sec) sections.push(sec);
    });

    if (!sections.length || !('IntersectionObserver' in window)) return;

    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var id = e.target.id;
        links.forEach(function (l) {
          var active = l.getAttribute('href') === '#' + id;
          l.classList.toggle('is-active', active);
          if (active) queueNavScroll(l);
        });
      });
    }, { rootMargin: '-35% 0px -50% 0px', threshold: 0 });

    sections.forEach(function (s) { obs.observe(s); });
  }

  var WHATSAPP_NUMBER = '56993015918';

  function buildWhatsappHref(text) {
    return 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(text);
  }

  function showReservationMessage(toast, message, isError) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.toggle('text-cyan-400', !isError);
    toast.classList.toggle('text-red-400', !!isError);
    toast.classList.remove('hidden');
  }

  function initForm() {
    document.querySelectorAll('[data-reservation-form]').forEach(function (form) {
      var toast = form.querySelector('[data-reservation-toast]');
      var waLink = form.querySelector('[data-reservation-whatsapp]');
      var btn = form.querySelector('button[type="submit"]');
      var dateInput = form.querySelector('[name="date"]');

      // Reservations need at least 1 day of lead time (see the same rule
      // enforced server-side) — greying today out in the picker avoids a
      // round-trip just to tell the customer it won't be accepted.
      if (dateInput) {
        var minDate = new Date();
        minDate.setDate(minDate.getDate() + 1);
        dateInput.min = minDate.getFullYear() + '-' + String(minDate.getMonth() + 1).padStart(2, '0') + '-' + String(minDate.getDate()).padStart(2, '0');
      }

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        showReservationMessage(toast, '', false);
        toast.classList.add('hidden');
        if (waLink) waLink.style.display = 'none';
        if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }

        var data = new FormData(form);
        var name = String(data.get('name') || '').trim();
        var phone = String(data.get('phone') || '').trim();
        var date = String(data.get('date') || '').trim();
        var partySize = parseInt(data.get('partySize'), 10);

        fetch('/api/reservations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name, phone: phone, date: date, partySize: partySize }),
        })
          .then(function (res) { return res.json().then(function (body) { return { ok: res.ok, body: body }; }); })
          .then(function (result) {
            if (result.ok) {
              showReservationMessage(toast, '¡Reserva recibida! Te esperamos — mesa asignada: ' + result.body.tableName + '.', false);
              if (waLink) {
                waLink.href = buildWhatsappHref(
                  'Hola, soy ' + name + '. Acabo de reservar para ' + partySize + ' personas el ' + date + '. ¡Gracias!'
                );
                waLink.style.display = 'flex';
              }
              form.reset();
            } else {
              showReservationMessage(toast, result.body.error || 'No pudimos procesar tu reserva.', true);
              if (result.body.fallbackWhatsapp && waLink) {
                waLink.href = buildWhatsappHref(
                  'Hola, quiero reservar para ' + (partySize || '') + ' personas el ' + date + '. ¿Me ayudan a coordinar?'
                );
                waLink.style.display = 'flex';
              }
            }
          })
          .catch(function () {
            showReservationMessage(toast, 'Error de conexión. Intenta de nuevo o escríbenos por WhatsApp.', true);
            if (waLink) {
              waLink.href = buildWhatsappHref('Hola, quiero reservar una mesa en After Office.');
              waLink.style.display = 'flex';
            }
          })
          .finally(function () {
            if (btn) {
              btn.disabled = false;
              btn.textContent = btn.getAttribute('data-label') || 'Enviar';
            }
          });
      });
    });
  }

  function todayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function bindEventFlyerFit(popup) {
    var dialog = popup.querySelector('.event-popup__dialog--flyer');
    var img = popup.querySelector('.event-popup__flyer-img');
    if (!dialog || !img) return;

    function syncFlyerLayout() {
      var nw = img.naturalWidth;
      var nh = img.naturalHeight;
      if (!nw || !nh) return;

      var ratio = nw / nh;
      var isLandscape = ratio >= 1.05;
      var isWide = ratio >= 0.72;
      var widthCap = isLandscape ? 'min(28rem, 94vw)' : isWide ? 'min(22rem, 92vw)' : 'min(20rem, 92vw)';

      dialog.style.width = widthCap;
      dialog.style.maxWidth = widthCap;
    }

    if (img.complete) syncFlyerLayout();
    else img.addEventListener('load', syncFlyerLayout, { once: true });

    window.addEventListener('resize', syncFlyerLayout, { passive: true });
  }

  function populatePopupFromData(popup) {
    var data = window.POPUP;
    if (!data) return true;
    if (!data.enabled) return false;

    var badge = popup.querySelector('#event-popup-badge');
    var eyebrow = popup.querySelector('#event-popup-eyebrow');
    var title = popup.querySelector('#event-popup-title');
    var img = popup.querySelector('#event-popup-img');
    var factsList = popup.querySelector('#event-popup-desc');
    var ctaPrimary = popup.querySelector('#event-popup-cta-primary');
    var ctaSecondary = popup.querySelector('#event-popup-cta-secondary');

    if (badge && data.badge) badge.textContent = data.badge;
    if (eyebrow && data.eyebrow) eyebrow.textContent = data.eyebrow;
    if (title && data.title) title.textContent = data.title;
    if (img && data.image) { img.src = data.image; img.alt = data.title || ''; }
    if (ctaPrimary) {
      if (data.ctaPrimaryLabel) ctaPrimary.textContent = data.ctaPrimaryLabel;
      if (data.ctaPrimaryHref) ctaPrimary.setAttribute('href', data.ctaPrimaryHref);
    }
    if (ctaSecondary) {
      if (data.ctaSecondaryLabel) ctaSecondary.textContent = data.ctaSecondaryLabel;
      if (data.ctaSecondaryHref) ctaSecondary.setAttribute('href', data.ctaSecondaryHref);
    }
    if (factsList && data.facts && data.facts.length) {
      factsList.innerHTML = data.facts.map(function (fact) {
        return (
          '<li class="event-popup__fact">' +
            '<i data-lucide="' + (fact.icon || 'sparkles').replace(/[^a-z0-9-]/g, '') + '" class="event-popup__fact-icon"></i>' +
            '<span>' + String(fact.text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</span>' +
          '</li>'
        );
      }).join('');
    }
    return true;
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Fills the landing page's "Comida & tragos" preview from the items the
  // admin marked as featured (see /js/featured-data.js, generated from D1).
  // A group with nothing marked yet is left as whatever is hardcoded in the
  // HTML, so the section never goes empty before the owner curates picks.
  function renderFeaturedGroup(gridId, items) {
    if (!items || !items.length) return;
    var grid = document.getElementById(gridId);
    if (!grid) return;
    var accents = ['carta-preview-card--cyan', 'carta-preview-card--magenta'];

    grid.innerHTML = items.slice(0, 3).map(function (item, i) {
      return (
        '<a href="carta.html" class="carta-preview-card ' + accents[i % 2] + '">' +
          '<div class="carta-preview-card__img-wrap">' +
            '<img data-img="' + escapeHtml(item.img || '') + '" alt="' + escapeHtml(item.name) + '" class="carta-preview-card__img" loading="lazy">' +
            '<span class="carta-preview-card__tag">' + escapeHtml(item.tag || '') + '</span>' +
          '</div>' +
          '<div class="carta-preview-card__body">' +
            '<h4 class="carta-preview-card__name">' + escapeHtml(item.name) + '</h4>' +
            '<p class="carta-preview-card__desc">' + escapeHtml(item.desc || '') + '</p>' +
            '<p class="carta-preview-card__price">' + escapeHtml(item.price || 'Solicitar al garzón') + '</p>' +
          '</div>' +
        '</a>'
      );
    }).join('');

    if (window.AOImages) window.AOImages.initImages(grid);
  }

  function initFeaturedMenu() {
    var data = window.FEATURED;
    if (!data) return;
    renderFeaturedGroup('featured-food-grid', data.comida);
    renderFeaturedGroup('featured-drinks-grid', data.trago);
    createIcons();
  }

  function initEventPopup() {
    var popup = document.getElementById('event-popup');
    if (!popup) return;

    if (!populatePopupFromData(popup)) return;

    bindEventFlyerFit(popup);

    var storageKey = 'ao-event-popup-dismissed';
    var sessionKey = 'ao-event-popup-seen';
    var dismissed = null;
    var seenSession = null;
    try {
      dismissed = localStorage.getItem(storageKey);
      seenSession = sessionStorage.getItem(sessionKey);
    } catch (e) { /* private mode */ }
    if (dismissed === todayKey() || seenSession === '1') return;

    var dialog = popup.querySelector('.event-popup__dialog');
    var closeBtn = popup.querySelector('.event-popup__close');
    var lastFocus = null;

    function markDismissed() {
      try { localStorage.setItem(storageKey, todayKey()); } catch (e) { /* ignore */ }
    }

    function closePopup(dismissToday) {
      try { sessionStorage.setItem(sessionKey, '1'); } catch (e) { /* ignore */ }
      popup.classList.remove('is-open');
      popup.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('event-popup-open');
      if (dismissToday) markDismissed();
      setTimeout(function () {
        popup.hidden = true;
        if (lastFocus && lastFocus.focus) lastFocus.focus();
      }, 420);
    }

    function openPopup() {
      if (userRecentlyScrolled(220)) {
        setTimeout(openPopup, 280);
        return;
      }
      lastFocus = document.activeElement;
      popup.hidden = false;
      popup.setAttribute('aria-hidden', 'false');
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          popup.classList.add('is-open');
          if (!isCoarsePointer()) {
            document.body.classList.add('event-popup-open');
          }
          if (closeBtn) closeBtn.focus();
          createIcons();
        });
      });
    }

    popup.querySelectorAll('[data-event-popup-close]').forEach(function (el) {
      el.addEventListener('click', function () { closePopup(false); });
    });

    var dismissBtn = popup.querySelector('[data-event-popup-dismiss]');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', function () { closePopup(true); });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && popup.classList.contains('is-open')) {
        e.preventDefault();
        closePopup(false);
      }
    });

    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var delay = reducedMotion ? 400 : 900;
    setTimeout(openPopup, delay);
  }

  function ensureHeroSlideImage(slide) {
    var img = slide && slide.querySelector('img');
    if (!img) return;
    var deferred = img.getAttribute('data-src');
    if (!deferred || img.getAttribute('src')) return;
    img.setAttribute('src', deferred);
    img.removeAttribute('data-src');
  }

  function preloadHeroSlide(slide) {
    ensureHeroSlideImage(slide);
    var img = slide && slide.querySelector('img');
    if (!img || !img.getAttribute('src')) return;
    var preload = new Image();
    preload.src = img.getAttribute('src');
  }

  function initHeroCarousel() {
    var carousel = document.querySelector('.hero-bg--carousel');
    if (!carousel) return;

    var slides = carousel.querySelectorAll('.hero-bg__slide');
    if (slides.length < 2) return;

    var index = 0;
    var intervalMs = 5500;
    var timer = null;
    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var fadeMs = reducedMotion ? 0 : 1400;

    carousel.style.setProperty('--hero-fade-ms', fadeMs + 'ms');
    if (reducedMotion) {
      carousel.classList.add('hero-bg--carousel-reduced');
    }

    ensureHeroSlideImage(slides[0]);
    preloadHeroSlide(slides[1]);

    function showSlide(next) {
      var nextIndex = (next + slides.length) % slides.length;
      preloadHeroSlide(slides[nextIndex]);
      slides[index].classList.remove('is-active');
      index = nextIndex;
      slides[index].classList.add('is-active');
    }

    function tick() {
      showSlide(index + 1);
    }

    function start() {
      if (timer) return;
      timer = setInterval(tick, intervalMs);
    }

    function stop() {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    }

    start();
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop();
      else start();
    });
  }

  function bootSite() {
    document.body.classList.remove('nav-open', 'event-popup-open');
    document.body.style.top = '';
    document.body.style.position = '';
    document.body.style.width = '';
    document.body.classList.add('has-site-mobile-bar');
    createIcons();
    initStickyOffsets();
    initMobileNav();
    initMobileBar();
    initLazyMap();
    initReveal();
    initSectionNav();
    initFeaturedMenu();
    initForm();
    initHashScroll();
    initEventPopup();
    initHeroCarousel();
    updateOpenBadges();
    setInterval(updateOpenBadges, 60000);
    window.addEventListener('scroll', markUserScroll, { passive: true });
  }

  document.documentElement.classList.remove('no-js');
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootSite);
  } else {
    bootSite();
  }
})();
