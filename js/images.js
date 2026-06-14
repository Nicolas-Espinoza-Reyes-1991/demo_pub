(function (global) {
  'use strict';

  var PRIMARY = './imagenes_carta/';
  var PLACEHOLDER = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">' +
    '<rect fill="#1c1917" width="400" height="300"/>' +
    '<text x="200" y="155" text-anchor="middle" fill="#78716c" font-family="sans-serif" font-size="14">After Office</text></svg>'
  );

  var observer = null;

  function encodePath(base, file) {
    return base + file.split('/').map(function (p) { return encodeURIComponent(p); }).join('/');
  }

  function applyImage(el, url) {
    if (el.getAttribute('data-img-loaded') === '1') return;
    el.setAttribute('data-img-loaded', '1');

    if (el.tagName === 'IMG') {
      el.src = url;
      el.onerror = function () {
        el.src = PLACEHOLDER;
        el.onerror = null;
      };
    } else {
      el.style.backgroundImage = 'url("' + url + '")';
    }
  }

  function resolveImage(file, cb) {
    if (!file) { cb(PLACEHOLDER); return; }
    cb(encodePath(PRIMARY, file));
  }

  function getObserver() {
    if (observer) return observer;
    if (!('IntersectionObserver' in window)) return null;

    observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        observer.unobserve(el);
        var file = el.getAttribute('data-img');
        resolveImage(file, function (url) {
          applyImage(el, url);
        });
      });
    }, { rootMargin: '240px 0px', threshold: 0.01 });

    return observer;
  }

  function initImages(root) {
    (root || document).querySelectorAll('[data-img]:not([data-img-loaded])').forEach(function (el) {
      var file = el.getAttribute('data-img');
      var io = getObserver();

      if (io) {
        io.observe(el);
        return;
      }

      resolveImage(file, function (url) {
        applyImage(el, url);
      });
    });
  }

  function loadImageImmediate(el) {
    if (!el) return;
    el.removeAttribute('data-img-loaded');
    var file = el.getAttribute('data-img');
    resolveImage(file, function (url) {
      applyImage(el, url);
    });
  }

  global.AOImages = {
    resolveImage: resolveImage,
    initImages: initImages,
    loadImageImmediate: loadImageImmediate,
    PLACEHOLDER: PLACEHOLDER
  };
})(typeof window !== 'undefined' ? window : this);
