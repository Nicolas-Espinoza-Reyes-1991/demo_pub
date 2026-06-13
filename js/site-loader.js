(function () {
  'use strict';

  var loader = document.getElementById('site-loader');
  if (!loader) return;

  var barFill = loader.querySelector('.site-loader__bar-fill');
  var bar = loader.querySelector('.site-loader__bar');
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MIN_MS = reducedMotion ? 350 : 850;
  var MAX_MS = 5200;
  var startedAt = Date.now();
  var hidden = false;
  var finishScheduled = false;

  function setProgress(pct) {
    var value = Math.min(100, Math.max(0, pct));
    if (barFill) barFill.style.width = value + '%';
    if (bar) bar.setAttribute('aria-valuenow', String(Math.round(value)));
  }

  function waitForImage(img) {
    return new Promise(function (resolve) {
      if (!img || img.complete) {
        resolve();
        return;
      }
      function done() {
        img.removeEventListener('load', done);
        img.removeEventListener('error', done);
        resolve();
      }
      img.addEventListener('load', done);
      img.addEventListener('error', done);
    });
  }

  function getCriticalImages() {
    var nodes = document.querySelectorAll(
      '.site-loader__logo, img[fetchpriority="high"], .hero-bg__slide img, img:not([loading="lazy"])'
    );
    var seen = new Set();
    var list = [];

    nodes.forEach(function (img) {
      if (img.closest('#event-popup')) return;
      if (seen.has(img)) return;
      seen.add(img);
      list.push(img);
    });

    return list;
  }

  function hideLoader() {
    if (hidden) return;
    hidden = true;
    setProgress(100);
    loader.classList.add('is-hidden');
    loader.setAttribute('aria-busy', 'false');
    document.body.classList.remove('site-loading');
    window.setTimeout(function () {
      if (loader.parentNode) loader.parentNode.removeChild(loader);
    }, 600);
  }

  function finishWhenReady() {
    if (finishScheduled) return;
    finishScheduled = true;
    var elapsed = Date.now() - startedAt;
    var remaining = Math.max(0, MIN_MS - elapsed);
    window.setTimeout(hideLoader, remaining);
  }

  function trackImages() {
    var images = getCriticalImages();
    var loaded = 0;

    function bump() {
      loaded += 1;
      if (images.length) {
        setProgress(10 + (loaded / images.length) * 82);
      }
    }

    if (!images.length) {
      finishWhenReady();
      return;
    }

    images.forEach(function (img) {
      waitForImage(img).then(bump);
    });

    Promise.race([
      Promise.all(images.map(waitForImage)),
      new Promise(function (resolve) {
        window.setTimeout(resolve, MAX_MS);
      })
    ]).then(finishWhenReady);
  }

  setProgress(6);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', trackImages);
  } else {
    trackImages();
  }
})();
