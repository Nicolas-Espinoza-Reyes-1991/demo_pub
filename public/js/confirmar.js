(function () {
  'use strict';

  function qs(id) { return document.getElementById(id); }

  function showState(name) {
    ['loading', 'error', 'picker', 'success'].forEach(function (s) {
      qs('confirm-state-' + s).hidden = s !== name;
    });
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  var TABLE_ICON =
    '<svg class="table-tile__icon" viewBox="0 0 100 100" aria-hidden="true">' +
      '<circle cx="50" cy="50" r="28"/>' +
      '<rect x="41" y="4" width="18" height="10" rx="3"/>' +
      '<rect x="41" y="86" width="18" height="10" rx="3"/>' +
      '<rect x="4" y="41" width="10" height="18" rx="3"/>' +
      '<rect x="86" y="41" width="10" height="18" rx="3"/>' +
    '</svg>';

  var token = new URLSearchParams(window.location.search).get('token');
  var selectedTableId = null;
  var partySize = 0;

  function renderTables(tables) {
    var grid = qs('confirm-tables-grid');
    var anyAvailable = tables.some(function (t) { return !t.taken && t.capacity >= partySize; });
    qs('confirm-no-tables').hidden = anyAvailable;

    grid.innerHTML = tables.map(function (t) {
      var tooSmall = t.capacity < partySize;
      var unavailable = t.taken || tooSmall;
      var badge = t.taken ? 'Ocupada' : (tooSmall ? 'Muy chica' : '');
      return (
        '<button type="button" role="listitem" class="table-tile' + (unavailable ? ' table-tile--unavailable' : '') + '" ' +
          'data-table-id="' + t.id + '"' + (unavailable ? ' disabled aria-disabled="true"' : '') + '>' +
          TABLE_ICON +
          '<span class="table-tile__name">' + escapeHtml(t.name) + '</span>' +
          '<span class="table-tile__capacity">' + t.capacity + ' personas</span>' +
          (badge ? '<span class="table-tile__badge">' + badge + '</span>' : '') +
        '</button>'
      );
    }).join('');
  }

  function updateSubmitState() {
    qs('confirm-submit').disabled = !selectedTableId;
  }

  document.addEventListener('click', function (e) {
    var tile = e.target.closest('.table-tile');
    if (!tile || tile.disabled) return;
    document.querySelectorAll('.table-tile--selected').forEach(function (t) { t.classList.remove('table-tile--selected'); });
    tile.classList.add('table-tile--selected');
    selectedTableId = tile.getAttribute('data-table-id');
    qs('confirm-pick-error').hidden = true;
    updateSubmitState();
  });

  function showError(message, fallbackWhatsapp) {
    qs('confirm-error-text').textContent = message;
    qs('confirm-error-whatsapp').hidden = !fallbackWhatsapp;
    showState('error');
  }

  function refreshAvailability() {
    fetch('/api/reservations/confirm?token=' + encodeURIComponent(token))
      .then(function (res) { return res.json(); })
      .then(function (body) { if (body.tables) renderTables(body.tables); })
      .catch(function () { /* best-effort refresh */ });
  }

  if (!token) {
    showError('Falta el enlace de confirmación. Revisa el correo que te enviamos.', false);
    return;
  }

  fetch('/api/reservations/confirm?token=' + encodeURIComponent(token))
    .then(function (res) { return res.json().then(function (body) { return { ok: res.ok, body: body }; }); })
    .then(function (result) {
      if (!result.ok) {
        showError(result.body.error || 'No pudimos abrir tu reserva.', !!result.body.fallbackWhatsapp);
        return;
      }
      partySize = result.body.partySize;
      qs('confirm-name').textContent = result.body.name;
      qs('confirm-party').textContent = result.body.partySize + ' personas';
      qs('confirm-date').textContent = result.body.date;
      renderTables(result.body.tables);
      showState('picker');
    })
    .catch(function () { showError('Error de conexión. Intenta de nuevo en un momento.', false); });

  qs('confirm-submit').addEventListener('click', function () {
    if (!selectedTableId) return;
    var btn = qs('confirm-submit');
    btn.disabled = true;
    btn.textContent = 'Confirmando...';
    qs('confirm-pick-error').hidden = true;

    fetch('/api/reservations/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token, tableId: selectedTableId }),
    })
      .then(function (res) { return res.json().then(function (body) { return { ok: res.ok, body: body }; }); })
      .then(function (result) {
        if (result.ok) {
          qs('confirm-success-table').textContent = result.body.tableName;
          showState('success');
          return;
        }
        var err = qs('confirm-pick-error');
        err.textContent = result.body.error || 'No pudimos confirmar esa mesa.';
        err.hidden = false;
        btn.textContent = 'Confirmar mesa';
        selectedTableId = null;
        updateSubmitState();
        refreshAvailability();
      })
      .catch(function () {
        var err = qs('confirm-pick-error');
        err.textContent = 'Error de conexión. Intenta de nuevo.';
        err.hidden = false;
        btn.disabled = false;
        btn.textContent = 'Confirmar mesa';
      });
  });
})();
