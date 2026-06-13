(function (global) {
  'use strict';

  var PRIMARY = './imagenes_carta/';
  var FALLBACK = './imagenes_sitio/';
  var PLACEHOLDER = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">' +
    '<rect fill="#1c1917" width="400" height="300"/>' +
    '<text x="200" y="155" text-anchor="middle" fill="#78716c" font-family="sans-serif" font-size="14">After Office</text></svg>'
  );

  function encodePath(base, file) {
    return base + file.split('/').map(function (p) { return encodeURIComponent(p); }).join('/');
  }

  function probe(url, cb) {
    var img = new Image();
    img.onload = function () { cb(true, url); };
    img.onerror = function () { cb(false); };
    img.src = url;
  }

  function resolveImage(file, cb) {
    if (!file) { cb(PLACEHOLDER); return; }
    var primary = encodePath(PRIMARY, file);
    var fallback = encodePath(FALLBACK, file);
    probe(primary, function (ok, url) {
      if (ok) { cb(url); return; }
      probe(fallback, function (ok2, url2) {
        cb(ok2 ? url2 : PLACEHOLDER);
      });
    });
  }

  function initImages(root) {
    (root || document).querySelectorAll('[data-img]').forEach(function (el) {
      var file = el.getAttribute('data-img');
      resolveImage(file, function (url) {
        if (el.tagName === 'IMG') {
          el.src = url;
        } else {
          el.style.backgroundImage = 'url("' + url + '")';
        }
      });
    });
  }

  global.AOImages = { resolveImage: resolveImage, initImages: initImages, PLACEHOLDER: PLACEHOLDER };
})(typeof window !== 'undefined' ? window : this);
