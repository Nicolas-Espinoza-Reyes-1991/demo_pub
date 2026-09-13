// Custom-styled date picker overlay for <input type="date">. The native
// calendar popup can't be restyled with CSS in any browser (only the small
// indicator icon can, via ::-webkit-calendar-picker-indicator, and only in
// Chromium/WebKit) -- so to make it match the site's dark neon theme this
// hides the native input (kept in the DOM as the real form value, so no
// other code needs to change) behind a clickable display + a custom
// calendar panel drawn entirely with our own markup/CSS.
(function () {
  'use strict';

  var MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var DOW = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

  var CALENDAR_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="3" y="4" width="18" height="18" rx="3"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';

  function pad(n) { return String(n).padStart(2, '0'); }
  function toIso(y, m, d) { return y + '-' + pad(m + 1) + '-' + pad(d); }
  function parseIso(str) {
    if (!str) return null;
    var parts = String(str).split('-');
    if (parts.length !== 3) return null;
    var y = parseInt(parts[0], 10), m = parseInt(parts[1], 10) - 1, d = parseInt(parts[2], 10);
    if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
    return { y: y, m: m, d: d };
  }
  function formatDisplay(str) {
    var p = parseIso(str);
    if (!p) return '';
    return p.d + ' ' + MONTHS_SHORT[p.m] + ' ' + p.y;
  }

  function attach(input, opts) {
    if (!input || input.__aodAttached) return;
    input.__aodAttached = true;
    opts = opts || {};

    var wrap = document.createElement('div');
    wrap.className = 'aod-date';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    input.classList.add('aod-date__native');
    input.setAttribute('tabindex', '-1');
    input.setAttribute('aria-hidden', 'true');

    var display = document.createElement('button');
    display.type = 'button';
    display.className = 'aod-date__display';
    if (input.disabled) display.disabled = true;
    var textSpan = document.createElement('span');
    textSpan.className = 'aod-date__text';
    var iconSpan = document.createElement('span');
    iconSpan.className = 'aod-date__icon';
    iconSpan.innerHTML = CALENDAR_SVG;
    display.appendChild(textSpan);
    display.appendChild(iconSpan);
    wrap.appendChild(display);

    var panel = document.createElement('div');
    panel.className = 'aod-date__panel';
    panel.hidden = true;
    wrap.appendChild(panel);

    var viewY, viewM;

    function syncText() {
      textSpan.textContent = input.value ? formatDisplay(input.value) : (opts.placeholder || 'Elige una fecha');
      textSpan.classList.toggle('aod-date__text--empty', !input.value);
    }
    input.__aodSync = syncText;

    function setDate(y, m, d) {
      input.value = toIso(y, m, d);
      syncText();
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      close();
    }

    function renderPanel() {
      var minP = parseIso(input.min);
      var maxP = parseIso(input.max);
      var selP = parseIso(input.value);
      var today = new Date();
      var minTime = minP ? new Date(minP.y, minP.m, minP.d).getTime() : null;
      var maxTime = maxP ? new Date(maxP.y, maxP.m, maxP.d).getTime() : null;

      var firstDow = (new Date(viewY, viewM, 1).getDay() + 6) % 7; // Monday-first
      var daysInMonth = new Date(viewY, viewM + 1, 0).getDate();

      var html = '<div class="aod-date__panel-head">' +
        '<button type="button" class="aod-date__nav" data-aod-prev aria-label="Mes anterior">&#8249;</button>' +
        '<span class="aod-date__label">' + MONTHS[viewM] + ' ' + viewY + '</span>' +
        '<button type="button" class="aod-date__nav" data-aod-next aria-label="Mes siguiente">&#8250;</button>' +
        '</div><div class="aod-date__grid">';
      DOW.forEach(function (d) { html += '<span class="aod-date__dow">' + d + '</span>'; });
      for (var i = 0; i < firstDow; i++) html += '<span class="aod-date__empty"></span>';
      for (var day = 1; day <= daysInMonth; day++) {
        var t = new Date(viewY, viewM, day).getTime();
        var disabled = (minTime !== null && t < minTime) || (maxTime !== null && t > maxTime);
        var isToday = today.getFullYear() === viewY && today.getMonth() === viewM && today.getDate() === day;
        var isSelected = !!(selP && selP.y === viewY && selP.m === viewM && selP.d === day);
        var cls = 'aod-date__day';
        if (isToday) cls += ' aod-date__day--today';
        if (isSelected) cls += ' aod-date__day--selected';
        html += '<button type="button" class="' + cls + '" data-aod-day="' + day + '"' + (disabled ? ' disabled' : '') + '>' + day + '</button>';
      }
      html += '</div>';
      panel.innerHTML = html;

      panel.querySelector('[data-aod-prev]').addEventListener('click', function (e) {
        e.stopPropagation();
        viewM--; if (viewM < 0) { viewM = 11; viewY--; }
        renderPanel();
      });
      panel.querySelector('[data-aod-next]').addEventListener('click', function (e) {
        e.stopPropagation();
        viewM++; if (viewM > 11) { viewM = 0; viewY++; }
        renderPanel();
      });
      panel.querySelectorAll('[data-aod-day]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          setDate(viewY, viewM, parseInt(btn.getAttribute('data-aod-day'), 10));
        });
      });
    }

    function onOutsideClick(e) {
      if (!wrap.contains(e.target)) close();
    }
    function onKeydown(e) {
      if (e.key === 'Escape') close();
    }
    function open() {
      if (display.disabled || !panel.hidden) return;
      var selP = parseIso(input.value);
      var minP = parseIso(input.min);
      var base = selP || minP || { y: new Date().getFullYear(), m: new Date().getMonth(), d: new Date().getDate() };
      viewY = base.y; viewM = base.m;
      renderPanel();
      panel.hidden = false;
      display.classList.add('aod-date__display--open');
      document.addEventListener('click', onOutsideClick, true);
      document.addEventListener('keydown', onKeydown, true);
    }
    function close() {
      panel.hidden = true;
      display.classList.remove('aod-date__display--open');
      document.removeEventListener('click', onOutsideClick, true);
      document.removeEventListener('keydown', onKeydown, true);
    }

    display.addEventListener('click', function () {
      if (panel.hidden) open(); else close();
    });

    if (input.form) {
      input.form.addEventListener('reset', function () { setTimeout(syncText, 0); });
    }

    syncText();
  }

  function refresh(input) {
    if (input && input.__aodSync) input.__aodSync();
  }

  window.AODatePicker = { attach: attach, refresh: refresh };
})();
