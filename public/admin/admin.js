(function () {
  'use strict';

  var state = {
    categories: [],
    items: [],
    activeCategoryId: null,
    editingItemId: null,
    popup: null,
  };

  var ICON = {
    up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>',
    down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  };

  document.querySelectorAll('[data-toggle-password]').forEach(function (btn) {
    var input = document.getElementById(btn.getAttribute('data-toggle-password'));
    var eye = btn.querySelector('.icon-eye');
    var eyeOff = btn.querySelector('.icon-eye-off');
    if (!input) return;
    btn.addEventListener('click', function () {
      var showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      if (showing) input.removeAttribute('data-password-visible');
      else input.setAttribute('data-password-visible', '');
      eye.hidden = !showing;
      eyeOff.hidden = showing;
      btn.setAttribute('aria-label', showing ? 'Mostrar contraseña' : 'Ocultar contraseña');
    });
  });

  function toast(message, type) {
    var el = document.getElementById('toast');
    el.innerHTML = (type === 'error' ? ICON.alert : ICON.check) + '<span>' + escapeHtml(message) + '</span>';
    el.className = 'admin-toast admin-toast--' + (type || 'ok');
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.hidden = true; }, 3500);
  }

  function api(path, options) {
    options = options || {};
    var method = (options.method || 'GET').toUpperCase();
    var headers = Object.assign({}, options.headers || {});
    if (method !== 'GET') headers['X-Admin-Request'] = '1';
    if (options.body) headers['Content-Type'] = 'application/json';

    return fetch(path, {
      method: method,
      headers: headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      credentials: 'same-origin',
    }).then(function (res) {
      if (res.status === 401) {
        window.location.href = './login.html';
        return Promise.reject(new Error('No autenticado'));
      }
      return res.json().then(function (data) {
        if (!res.ok) throw new Error(data.error || 'Error inesperado.');
        return data;
      });
    });
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ---------- Image upload / preview ----------
  function resolveImageUrl(value, basePath) {
    if (!value) return null;
    // Any value with a "/" (an R2 upload like "/media/..." or a legacy
    // relative path like "./imagenes_sitio/x.png") is meant to be resolved
    // from the site root, not from "/admin/" where this page actually lives.
    if (value.indexOf('/') !== -1) return '/' + value.replace(/^\.?\//, '');
    return basePath + encodeURIComponent(value);
  }

  function setImagePreview(previewId, hintId, value, basePath) {
    var img = document.getElementById(previewId);
    var hint = document.getElementById(hintId);
    var dropzone = hint.closest('.image-dropzone');
    var icon = dropzone ? dropzone.querySelector('.image-dropzone__icon') : null;
    var subhint = dropzone ? dropzone.querySelector('.image-dropzone__subhint') : null;
    var url = resolveImageUrl(value, basePath);
    if (url) {
      img.src = url;
      img.hidden = false;
      hint.hidden = true;
      if (icon) icon.hidden = true;
      if (subhint) subhint.hidden = true;
    } else {
      img.hidden = true;
      hint.hidden = false;
      if (icon) icon.hidden = false;
      if (subhint) subhint.hidden = false;
    }
  }

  function discardImage(url) {
    if (!url || url.indexOf('/media/') !== 0) return;
    fetch('/api/images?path=' + encodeURIComponent(url), {
      method: 'DELETE',
      headers: { 'X-Admin-Request': '1' },
      credentials: 'same-origin',
    }).catch(function () { /* best-effort; the daily sweep will catch it anyway */ });
  }

  // Tracks uploads made while a form is open but not yet saved, so an
  // abandoned or superseded photo is deleted right away instead of waiting
  // for the daily server-side sweep.
  function initImageDropzone(opts) {
    var dropzone = document.getElementById(opts.dropzoneId);
    var fileInput = document.getElementById(opts.fileInputId);
    var hidden = document.getElementById(opts.hiddenInputId);
    var hint = document.getElementById(opts.hintId);
    var defaultHint = hint.textContent;
    var baseline = '';
    var pending = null;

    function openPicker() { fileInput.click(); }

    var icon = dropzone.querySelector('.image-dropzone__icon');
    var subhint = dropzone.querySelector('.image-dropzone__subhint');

    function handleFile(file) {
      if (!/^image\//.test(file.type)) { toast('El archivo debe ser una imagen.', 'error'); return; }
      dropzone.classList.add('is-uploading');
      hint.hidden = false;
      hint.innerHTML = '<span class="spinner"></span> Subiendo...';
      if (icon) icon.hidden = true;
      if (subhint) subhint.hidden = true;

      var formData = new FormData();
      formData.append('file', file);

      fetch('/api/images/upload', {
        method: 'POST',
        headers: { 'X-Admin-Request': '1' },
        body: formData,
        credentials: 'same-origin',
      })
        .then(function (res) {
          if (res.status === 401) {
            window.location.href = './login.html';
            return Promise.reject(new Error('No autenticado'));
          }
          return res.json().then(function (data) { return { ok: res.ok, data: data }; });
        })
        .then(function (result) {
          dropzone.classList.remove('is-uploading');
          if (!result.ok) {
            toast(result.data.error || 'Error al subir la imagen.', 'error');
            hint.textContent = defaultHint;
            setImagePreview(opts.previewId, opts.hintId, hidden.value, opts.basePath);
            return;
          }
          if (pending && pending !== baseline) discardImage(pending);
          pending = result.data.url;
          hidden.value = result.data.url;
          hint.textContent = defaultHint;
          setImagePreview(opts.previewId, opts.hintId, result.data.url, opts.basePath);
        })
        .catch(function (err) {
          dropzone.classList.remove('is-uploading');
          hint.textContent = defaultHint;
          if (err.message !== 'No autenticado') {
            toast('Error de conexión al subir la imagen.', 'error');
            setImagePreview(opts.previewId, opts.hintId, hidden.value, opts.basePath);
          }
        });

      fileInput.value = '';
    }

    dropzone.addEventListener('click', openPicker);
    dropzone.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPicker(); }
    });
    dropzone.addEventListener('dragover', function (e) { e.preventDefault(); dropzone.classList.add('is-dragover'); });
    dropzone.addEventListener('dragleave', function () { dropzone.classList.remove('is-dragover'); });
    dropzone.addEventListener('drop', function (e) {
      e.preventDefault();
      dropzone.classList.remove('is-dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', function () {
      if (fileInput.files && fileInput.files[0]) handleFile(fileInput.files[0]);
    });

    return {
      // Call when opening a form: remembers the persisted value so we know
      // whether a later upload is "new" (and therefore discardable) or not.
      setBaseline: function (value) {
        baseline = value || '';
        pending = null;
      },
      // Call when the form is saved successfully: the pending upload is now
      // owned by the saved record, so stop tracking it for discard.
      commit: function () {
        pending = null;
      },
      // Call when the form is closed/cancelled without saving: deletes
      // whatever was uploaded during this edit that never got persisted.
      discardPending: function () {
        if (pending && pending !== baseline) discardImage(pending);
        pending = null;
      },
    };
  }

  var itemImageDropzone = initImageDropzone({
    dropzoneId: 'item-image-dropzone',
    fileInputId: 'item-image-file',
    hiddenInputId: 'item-image',
    previewId: 'item-image-preview',
    hintId: 'item-image-hint',
    basePath: './../imagenes_carta/',
  });
  var popupImageDropzone = initImageDropzone({
    dropzoneId: 'popup-image-dropzone',
    fileInputId: 'popup-image-file',
    hiddenInputId: 'popup-image',
    previewId: 'popup-image-preview',
    hintId: 'popup-image-hint',
    basePath: '',
  });

  // ---------- Tabs ----------
  document.querySelectorAll('.admin-tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      document.querySelectorAll('.admin-tab').forEach(function (t) { t.classList.remove('is-active'); });
      document.querySelectorAll('.admin-panel').forEach(function (p) { p.classList.remove('is-active'); });
      tab.classList.add('is-active');
      document.getElementById(tab.getAttribute('data-panel')).classList.add('is-active');
    });
  });

  // ---------- Session ----------
  function loadMe() {
    return api('/api/auth/me').then(function (data) {
      document.getElementById('current-username').textContent = data.username;
    });
  }

  document.getElementById('btn-logout').addEventListener('click', function () {
    api('/api/auth/logout', { method: 'POST' }).finally(function () {
      window.location.href = './login.html';
    });
  });

  // ---------- Menu: categories ----------
  function loadMenu() {
    return api('/api/menu').then(function (data) {
      state.categories = data.categories;
      state.items = data.items;
      if (!state.activeCategoryId && state.categories.length) {
        state.activeCategoryId = state.categories[0].id;
      }
      renderCategories();
      renderItems();
    });
  }

  function renderCategories() {
    var list = document.getElementById('category-list');
    list.innerHTML = state.categories.map(function (cat) {
      var active = cat.id === state.activeCategoryId;
      return (
        '<div class="category-chip' + (active ? ' is-active' : '') + '" data-id="' + escapeHtml(cat.id) + '">' +
          '<button type="button" class="category-chip__label" data-action="select">' + escapeHtml(cat.label) + '</button>' +
          '<span class="category-chip__actions">' +
            '<button type="button" data-action="up" title="Subir">' + ICON.up + '</button>' +
            '<button type="button" data-action="down" title="Bajar">' + ICON.down + '</button>' +
            '<button type="button" data-action="rename" title="Renombrar">' + ICON.edit + '</button>' +
            '<button type="button" class="is-danger" data-action="delete" title="Eliminar">' + ICON.trash + '</button>' +
          '</span>' +
        '</div>'
      );
    }).join('') || (
      '<p class="empty-hint">' + ICON.image + '<span>Todavía no hay categorías. Crea la primera abajo.</span></p>'
    );
  }

  document.getElementById('category-list').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    var chip = e.target.closest('.category-chip');
    var id = chip.getAttribute('data-id');
    var action = btn.getAttribute('data-action');

    if (action === 'select') {
      state.activeCategoryId = id;
      state.editingItemId = null;
      renderCategories();
      renderItems();
      return;
    }
    if (action === 'up' || action === 'down') {
      api('/api/menu/categories/' + encodeURIComponent(id) + '/move', { method: 'POST', body: { direction: action } })
        .then(loadMenu)
        .catch(function (err) { toast(err.message, 'error'); });
      return;
    }
    if (action === 'rename') {
      var cat = state.categories.filter(function (c) { return c.id === id; })[0];
      var label = window.prompt('Nuevo nombre de la categoría', cat ? cat.label : '');
      if (label == null || !label.trim()) return;
      api('/api/menu/categories/' + encodeURIComponent(id), { method: 'PUT', body: { label: label.trim() } })
        .then(function () { toast('Categoría actualizada.'); loadMenu(); })
        .catch(function (err) { toast(err.message, 'error'); });
      return;
    }
    if (action === 'delete') {
      if (!window.confirm('¿Eliminar esta categoría y todos sus productos? Esta acción no se puede deshacer.')) return;
      api('/api/menu/categories/' + encodeURIComponent(id), { method: 'DELETE' })
        .then(function () {
          if (state.activeCategoryId === id) state.activeCategoryId = null;
          toast('Categoría eliminada.');
          loadMenu();
        })
        .catch(function (err) { toast(err.message, 'error'); });
    }
  });

  document.getElementById('btn-add-category').addEventListener('click', function () {
    var idInput = document.getElementById('new-cat-id');
    var labelInput = document.getElementById('new-cat-label');
    var id = idInput.value.trim().toLowerCase();
    var label = labelInput.value.trim();
    if (!id || !label) { toast('Completa el id y el nombre.', 'error'); return; }

    api('/api/menu/categories', { method: 'POST', body: { id: id, label: label } })
      .then(function () {
        idInput.value = '';
        labelInput.value = '';
        toast('Categoría creada.');
        loadMenu();
      })
      .catch(function (err) { toast(err.message, 'error'); });
  });

  // ---------- Menu: items ----------
  function itemsForActiveCategory() {
    return state.items
      .filter(function (it) { return it.categoryId === state.activeCategoryId; })
      .sort(function (a, b) { return a.sortOrder - b.sortOrder; });
  }

  function renderItems() {
    var card = document.getElementById('items-card');
    var title = document.getElementById('items-card-title');
    var list = document.getElementById('item-list');

    if (!state.activeCategoryId) {
      card.hidden = true;
      return;
    }
    card.hidden = false;
    var cat = state.categories.filter(function (c) { return c.id === state.activeCategoryId; })[0];
    title.textContent = 'Productos · ' + (cat ? cat.label : '');

    var items = itemsForActiveCategory();
    list.innerHTML = items.map(function (it) {
      var img = resolveImageUrl(it.img, './../imagenes_carta/');
      return (
        '<div class="item-row" data-id="' + it.id + '">' +
          '<span class="item-row__thumb">' + (img ? '<img src="' + img + '" alt="">' : ICON.image) + '</span>' +
          '<div>' +
            '<div class="item-row__title">' + escapeHtml(it.name) +
              (it.featuredGroup ? ' <span class="status-pill status-pill--confirmada">Destacado · ' + (it.featuredGroup === 'comida' ? 'comida' : 'trago') + '</span>' : '') +
            '</div>' +
            '<div class="item-row__meta">' + escapeHtml(it.price || 'Solicitar al garzón') + '</div>' +
          '</div>' +
          '<div class="item-row__actions">' +
            '<button type="button" class="btn btn--small btn--icon btn--ghost" data-action="up" title="Subir">' + ICON.up + '</button>' +
            '<button type="button" class="btn btn--small btn--icon btn--ghost" data-action="down" title="Bajar">' + ICON.down + '</button>' +
            '<button type="button" class="btn btn--small" data-action="edit">' + ICON.edit + ' Editar</button>' +
            '<button type="button" class="btn btn--small btn--danger" data-action="delete">' + ICON.trash + '</button>' +
          '</div>' +
        '</div>'
      );
    }).join('') || (
      '<p class="empty-hint">' + ICON.image + '<span>Sin productos en esta categoría todavía.</span></p>'
    );

    list.querySelectorAll('.item-row__thumb img').forEach(function (img) {
      img.addEventListener('error', function () {
        img.replaceWith(document.createRange().createContextualFragment(ICON.image));
      }, { once: true });
    });
  }

  document.getElementById('item-list').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    var row = e.target.closest('.item-row');
    var id = Number(row.getAttribute('data-id'));
    var action = btn.getAttribute('data-action');

    if (action === 'up' || action === 'down') {
      api('/api/menu/items/' + id + '/move', { method: 'POST', body: { direction: action } })
        .then(loadMenu)
        .catch(function (err) { toast(err.message, 'error'); });
      return;
    }
    if (action === 'edit') {
      var item = state.items.filter(function (it) { return it.id === id; })[0];
      openItemForm(item);
      return;
    }
    if (action === 'delete') {
      if (!window.confirm('¿Eliminar este producto?')) return;
      api('/api/menu/items/' + id, { method: 'DELETE' })
        .then(function () { toast('Producto eliminado.'); loadMenu(); })
        .catch(function (err) { toast(err.message, 'error'); });
    }
  });

  function openItemForm(item) {
    state.editingItemId = item ? item.id : null;
    document.getElementById('item-form-card').hidden = false;
    document.getElementById('item-form-title').textContent = item ? 'Editar producto' : 'Nuevo producto';
    document.getElementById('item-name').value = item ? item.name : '';
    document.getElementById('item-desc').value = item ? item.desc : '';
    document.getElementById('item-price').value = item ? item.price : '';
    document.getElementById('item-tags').value = item && item.tags ? item.tags.join(', ') : '';
    document.getElementById('item-featured').value = item ? (item.featuredGroup || '') : '';
    document.getElementById('item-image').value = item ? item.img : '';
    setImagePreview('item-image-preview', 'item-image-hint', item ? item.img : '', './../imagenes_carta/');
    itemImageDropzone.setBaseline(item ? item.img : '');
    document.getElementById('item-form-card').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  document.getElementById('btn-add-item').addEventListener('click', function () { openItemForm(null); });
  document.getElementById('btn-cancel-item').addEventListener('click', function () {
    document.getElementById('item-form-card').hidden = true;
    state.editingItemId = null;
    itemImageDropzone.discardPending();
  });

  document.getElementById('btn-save-item').addEventListener('click', function () {
    var body = {
      categoryId: state.activeCategoryId,
      name: document.getElementById('item-name').value.trim(),
      description: document.getElementById('item-desc').value.trim(),
      price: document.getElementById('item-price').value.trim(),
      image: document.getElementById('item-image').value.trim(),
      tags: document.getElementById('item-tags').value.split(',').map(function (t) { return t.trim(); }).filter(Boolean),
      featuredGroup: document.getElementById('item-featured').value,
    };

    var request = state.editingItemId
      ? api('/api/menu/items/' + state.editingItemId, { method: 'PUT', body: body })
      : api('/api/menu/items', { method: 'POST', body: body });

    request
      .then(function () {
        toast('Producto guardado.');
        document.getElementById('item-form-card').hidden = true;
        state.editingItemId = null;
        itemImageDropzone.commit();
        loadMenu();
      })
      .catch(function (err) { toast(err.message, 'error'); });
  });

  // ---------- Popup ----------
  function loadPopup() {
    return api('/api/popup').then(function (data) {
      state.popup = data;
      renderPopupForm();
    });
  }

  function renderPopupForm() {
    var p = state.popup;
    document.getElementById('popup-enabled').checked = !!p.enabled;
    document.getElementById('popup-badge').value = p.badge || '';
    document.getElementById('popup-eyebrow').value = p.eyebrow || '';
    document.getElementById('popup-title').value = p.title || '';
    document.getElementById('popup-image').value = p.image || '';
    document.getElementById('popup-cta1-label').value = p.ctaPrimaryLabel || '';
    document.getElementById('popup-cta1-href').value = p.ctaPrimaryHref || '';
    document.getElementById('popup-cta2-label').value = p.ctaSecondaryLabel || '';
    document.getElementById('popup-cta2-href').value = p.ctaSecondaryHref || '';
    setImagePreview('popup-image-preview', 'popup-image-hint', p.image || '', '');
    popupImageDropzone.setBaseline(p.image || '');
    renderFacts(p.facts || []);
  }

  function renderFacts(facts) {
    var list = document.getElementById('fact-list');
    list.innerHTML = facts.map(function (fact, i) {
      return (
        '<div class="fact-row" data-index="' + i + '">' +
          '<input type="text" class="fact-icon" placeholder="ícono" value="' + escapeHtml(fact.icon) + '">' +
          '<input type="text" class="fact-text" placeholder="texto" value="' + escapeHtml(fact.text) + '" maxlength="80">' +
          '<button type="button" class="btn btn--small btn--icon btn--danger" data-action="remove-fact" title="Quitar">' + ICON.trash + '</button>' +
        '</div>'
      );
    }).join('');
  }

  document.getElementById('btn-add-fact').addEventListener('click', function () {
    var list = document.getElementById('fact-list');
    var div = document.createElement('div');
    div.className = 'fact-row';
    div.innerHTML =
      '<input type="text" class="fact-icon" placeholder="ícono" value="sparkles">' +
      '<input type="text" class="fact-text" placeholder="texto" maxlength="80">' +
      '<button type="button" class="btn btn--small btn--icon btn--danger" data-action="remove-fact" title="Quitar">' + ICON.trash + '</button>';
    list.appendChild(div);
  });

  document.getElementById('fact-list').addEventListener('click', function (e) {
    if (e.target.getAttribute('data-action') === 'remove-fact') {
      e.target.closest('.fact-row').remove();
    }
  });

  document.getElementById('btn-save-popup').addEventListener('click', function () {
    var facts = Array.prototype.map.call(document.querySelectorAll('#fact-list .fact-row'), function (row) {
      return {
        icon: row.querySelector('.fact-icon').value.trim(),
        text: row.querySelector('.fact-text').value.trim(),
      };
    }).filter(function (f) { return f.text; });

    var body = {
      enabled: document.getElementById('popup-enabled').checked,
      badge: document.getElementById('popup-badge').value.trim(),
      eyebrow: document.getElementById('popup-eyebrow').value.trim(),
      title: document.getElementById('popup-title').value.trim(),
      image: document.getElementById('popup-image').value.trim(),
      facts: facts,
      ctaPrimaryLabel: document.getElementById('popup-cta1-label').value.trim(),
      ctaPrimaryHref: document.getElementById('popup-cta1-href').value.trim(),
      ctaSecondaryLabel: document.getElementById('popup-cta2-label').value.trim(),
      ctaSecondaryHref: document.getElementById('popup-cta2-href').value.trim(),
    };

    api('/api/popup', { method: 'PUT', body: body })
      .then(function () { toast('Popup actualizado.'); popupImageDropzone.commit(); loadPopup(); })
      .catch(function (err) { toast(err.message, 'error'); });
  });

  // ---------- Reservations: tables ----------
  var STATUS_LABEL = { pendiente: 'Pendiente', confirmada: 'Confirmada', no_show: 'No llegó', cancelada: 'Cancelada' };

  function loadTables() {
    return api('/api/reservations/tables').then(function (data) {
      state.tables = data.tables;
      renderTables();
    });
  }

  function renderTables() {
    var list = document.getElementById('table-list');
    list.innerHTML = state.tables.map(function (t) {
      return (
        '<div class="item-row" data-id="' + t.id + '">' +
          '<span class="item-row__thumb">' + t.capacity + '</span>' +
          '<div>' +
            '<div class="item-row__title">' + escapeHtml(t.name) + (t.active ? '' : ' <span class="status-pill status-pill--cancelada">Inactiva</span>') + '</div>' +
            '<div class="item-row__meta">Capacidad: ' + t.capacity + ' personas</div>' +
          '</div>' +
          '<div class="item-row__actions">' +
            '<button type="button" class="btn btn--small" data-action="toggle">' + (t.active ? 'Desactivar' : 'Activar') + '</button>' +
            '<button type="button" class="btn btn--small btn--icon btn--danger" data-action="delete">' + ICON.trash + '</button>' +
          '</div>' +
        '</div>'
      );
    }).join('') || (
      '<p class="empty-hint">' + ICON.image + '<span>Todavía no hay mesas. Crea la primera abajo.</span></p>'
    );
  }

  document.getElementById('table-list').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    var row = e.target.closest('.item-row');
    var id = Number(row.getAttribute('data-id'));
    var table = state.tables.filter(function (t) { return t.id === id; })[0];
    if (!table) return;

    if (btn.getAttribute('data-action') === 'toggle') {
      api('/api/reservations/tables/' + id, { method: 'PUT', body: { name: table.name, capacity: table.capacity, active: !table.active } })
        .then(function () { toast('Mesa actualizada.'); loadTables(); })
        .catch(function (err) { toast(err.message, 'error'); });
      return;
    }
    if (btn.getAttribute('data-action') === 'delete') {
      if (!window.confirm('¿Eliminar esta mesa?')) return;
      api('/api/reservations/tables/' + id, { method: 'DELETE' })
        .then(function () { toast('Mesa eliminada.'); loadTables(); })
        .catch(function (err) { toast(err.message, 'error'); });
    }
  });

  document.getElementById('btn-add-table').addEventListener('click', function () {
    var nameInput = document.getElementById('new-table-name');
    var capInput = document.getElementById('new-table-capacity');
    var name = nameInput.value.trim();
    var capacity = parseInt(capInput.value, 10);
    if (!name || !capacity) { toast('Completa el nombre y la capacidad.', 'error'); return; }

    api('/api/reservations/tables', { method: 'POST', body: { name: name, capacity: capacity } })
      .then(function () {
        nameInput.value = '';
        capInput.value = '';
        toast('Mesa creada.');
        loadTables();
      })
      .catch(function (err) { toast(err.message, 'error'); });
  });

  // ---------- Reservations: bookings ----------
  function loadReservations(date) {
    var path = date ? '/api/reservations?date=' + encodeURIComponent(date) : '/api/reservations';
    return api(path).then(function (data) {
      state.reservations = data.reservations;
      renderReservations();
    });
  }

  function renderReservations() {
    var list = document.getElementById('reservation-list');
    if (!state.reservations.length) {
      list.innerHTML = '<p class="empty-hint">' + ICON.image + '<span>No hay reservas para mostrar.</span></p>';
      return;
    }
    list.innerHTML = state.reservations.map(function (r) {
      var metaParts = [
        r.reservation_date,
        r.arrival_time ? r.arrival_time + ' hrs' : null,
        r.party_size + ' personas',
        r.table_name ? 'Mesa: ' + r.table_name : 'Sin mesa asignada',
      ].filter(Boolean);
      var options = Object.keys(STATUS_LABEL).map(function (s) {
        return '<option value="' + s + '"' + (s === r.status ? ' selected' : '') + '>' + STATUS_LABEL[s] + '</option>';
      }).join('');
      return (
        '<div class="item-row" data-id="' + r.id + '">' +
          '<span class="item-row__thumb item-row__thumb--' + r.status + '">' + ICON.calendar + '</span>' +
          '<div>' +
            '<div class="item-row__title">' + escapeHtml(r.customer_name) + '</div>' +
            '<div class="item-row__meta">' + escapeHtml(metaParts.join(' · ')) + '</div>' +
            '<div class="item-row__meta"><a href="tel:' + escapeHtml(r.phone) + '">' + escapeHtml(r.phone) + '</a>' + (r.notes ? ' · ' + escapeHtml(r.notes) : '') + '</div>' +
          '</div>' +
          '<div class="item-row__actions">' +
            '<select class="mini-select" data-action="status">' + options + '</select>' +
            '<button type="button" class="btn btn--small btn--icon btn--danger" data-action="delete">' + ICON.trash + '</button>' +
          '</div>' +
        '</div>'
      );
    }).join('');
  }

  document.getElementById('reservation-list').addEventListener('change', function (e) {
    if (e.target.getAttribute('data-action') !== 'status') return;
    var id = Number(e.target.closest('.item-row').getAttribute('data-id'));
    api('/api/reservations/' + id, { method: 'PUT', body: { status: e.target.value } })
      .then(function () {
        toast('Reserva actualizada.');
        var r = state.reservations.filter(function (x) { return x.id === id; })[0];
        if (r) r.status = e.target.value;
        renderReservations();
      })
      .catch(function (err) { toast(err.message, 'error'); });
  });

  document.getElementById('reservation-list').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-action="delete"]');
    if (!btn) return;
    if (!window.confirm('¿Eliminar esta reserva?')) return;
    var id = Number(e.target.closest('.item-row').getAttribute('data-id'));
    api('/api/reservations/' + id, { method: 'DELETE' })
      .then(function () {
        toast('Reserva eliminada.');
        state.reservations = state.reservations.filter(function (r) { return r.id !== id; });
        renderReservations();
      })
      .catch(function (err) { toast(err.message, 'error'); });
  });

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  document.getElementById('reservations-date').addEventListener('change', function (e) {
    loadReservations(e.target.value || null).catch(function (err) { toast(err.message, 'error'); });
  });
  document.getElementById('btn-reservations-today').addEventListener('click', function () {
    var input = document.getElementById('reservations-date');
    input.value = todayStr();
    loadReservations(input.value).catch(function (err) { toast(err.message, 'error'); });
  });
  document.getElementById('btn-reservations-all').addEventListener('click', function () {
    document.getElementById('reservations-date').value = '';
    loadReservations(null).catch(function (err) { toast(err.message, 'error'); });
  });

  // ---------- Reservations: blocked dates ----------
  function loadBlocks() {
    return api('/api/reservations/blocks').then(function (data) {
      state.blocks = data.blocks;
      renderBlocks();
    });
  }

  function renderBlocks() {
    var list = document.getElementById('block-list');
    list.innerHTML = state.blocks.map(function (b) {
      return (
        '<div class="item-row" data-id="' + b.id + '">' +
          '<span class="item-row__thumb">' + ICON.calendar + '</span>' +
          '<div>' +
            '<div class="item-row__title">' + escapeHtml(b.blocked_date) + '</div>' +
            '<div class="item-row__meta">' + escapeHtml(b.reason || 'Sin motivo especificado') + '</div>' +
          '</div>' +
          '<div class="item-row__actions">' +
            '<button type="button" class="btn btn--small btn--icon btn--danger" data-action="delete">' + ICON.trash + '</button>' +
          '</div>' +
        '</div>'
      );
    }).join('') || (
      '<p class="empty-hint">' + ICON.image + '<span>No hay fechas bloqueadas.</span></p>'
    );
  }

  document.getElementById('block-list').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-action="delete"]');
    if (!btn) return;
    if (!window.confirm('¿Quitar este bloqueo?')) return;
    var id = Number(e.target.closest('.item-row').getAttribute('data-id'));
    api('/api/reservations/blocks/' + id, { method: 'DELETE' })
      .then(function () { toast('Bloqueo eliminado.'); loadBlocks(); })
      .catch(function (err) { toast(err.message, 'error'); });
  });

  document.getElementById('btn-add-block').addEventListener('click', function () {
    var dateInput = document.getElementById('new-block-date');
    var reasonInput = document.getElementById('new-block-reason');
    if (!dateInput.value) { toast('Elige una fecha.', 'error'); return; }

    api('/api/reservations/blocks', { method: 'POST', body: { date: dateInput.value, reason: reasonInput.value.trim() } })
      .then(function () {
        dateInput.value = '';
        reasonInput.value = '';
        toast('Fecha bloqueada.');
        loadBlocks();
      })
      .catch(function (err) { toast(err.message, 'error'); });
  });

  function loadReservationsTab() {
    document.getElementById('reservations-date').value = todayStr();
    return Promise.all([loadTables(), loadReservations(todayStr()), loadBlocks()]);
  }

  // ---------- Account ----------
  document.getElementById('btn-change-password').addEventListener('click', function () {
    var currentPassword = document.getElementById('current-password').value;
    var newPassword = document.getElementById('new-password').value;

    api('/api/auth/change-password', { method: 'POST', body: { currentPassword: currentPassword, newPassword: newPassword } })
      .then(function () {
        toast('Contraseña actualizada. Vuelve a iniciar sesión.');
        setTimeout(function () { window.location.href = './login.html'; }, 1500);
      })
      .catch(function (err) { toast(err.message, 'error'); });
  });

  document.getElementById('btn-check-orphans').addEventListener('click', function () {
    var result = document.getElementById('orphans-result');
    var cleanupBtn = document.getElementById('btn-cleanup-orphans');
    result.textContent = 'Revisando...';
    api('/api/images/orphans')
      .then(function (data) {
        if (!data.count) {
          result.textContent = 'No hay imágenes sin usar en este momento.';
          cleanupBtn.hidden = true;
          return;
        }
        result.textContent = data.count + ' imagen(es) sin usar (subidas hace más de 1 hora y sin guardar).';
        cleanupBtn.hidden = false;
      })
      .catch(function (err) { toast(err.message, 'error'); });
  });

  document.getElementById('btn-cleanup-orphans').addEventListener('click', function () {
    var result = document.getElementById('orphans-result');
    api('/api/images/cleanup', { method: 'POST' })
      .then(function (data) {
        result.textContent = 'Se eliminaron ' + data.deleted + ' imagen(es).';
        document.getElementById('btn-cleanup-orphans').hidden = true;
        toast('Limpieza completa.');
      })
      .catch(function (err) { toast(err.message, 'error'); });
  });

  // ---------- QR ----------
  var QR_TARGET_URL = 'https://afterofficefutrono.cl/carta';

  function drawRoundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function renderQrCode() {
    var canvas = document.getElementById('qr-canvas');
    var ctx = canvas.getContext('2d');
    var size = canvas.width;

    var qr = qrcode(0, 'H');
    qr.addData(QR_TARGET_URL);
    qr.make();

    var moduleCount = qr.getModuleCount();
    var marginModules = 2;
    var cell = size / (moduleCount + marginModules * 2);
    var offset = marginModules * cell;

    function inFinder(row, col) {
      var last = moduleCount - 7;
      return (row < 7 && col < 7) || (row < 7 && col >= last) || (row >= last && col < 7);
    }

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    // Data modules: rounded dots in the brand gradient.
    var gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, '#22d3ee');
    gradient.addColorStop(1, '#d946ef');
    ctx.fillStyle = gradient;
    for (var r = 0; r < moduleCount; r += 1) {
      for (var c = 0; c < moduleCount; c += 1) {
        if (!qr.isDark(r, c) || inFinder(r, c)) continue;
        var x = offset + c * cell;
        var y = offset + r * cell;
        var pad = cell * 0.14;
        drawRoundedRect(ctx, x + pad, y + pad, cell - pad * 2, cell - pad * 2, (cell - pad * 2) / 2.4);
        ctx.fill();
      }
    }

    // Finder patterns (the 3 corner squares): solid dark, so scanners lock on reliably.
    ctx.fillStyle = '#0a0a0f';
    [[0, 0], [0, moduleCount - 7], [moduleCount - 7, 0]].forEach(function (pos) {
      for (var r = 0; r < 7; r += 1) {
        for (var c = 0; c < 7; c += 1) {
          if (!qr.isDark(pos[0] + r, pos[1] + c)) continue;
          ctx.fillRect(offset + (pos[1] + c) * cell, offset + (pos[0] + r) * cell, cell + 0.5, cell + 0.5);
        }
      }
    });

    // Center logo: same dark rounded square + "AO" gradient monogram as the site favicon.
    // High error correction ('H') tolerates this without hurting scannability.
    var logoSize = size * 0.22;
    var padSize = logoSize * 1.18;
    var padPos = (size - padSize) / 2;
    var logoPos = (size - logoSize) / 2;

    ctx.fillStyle = '#ffffff';
    drawRoundedRect(ctx, padPos, padPos, padSize, padSize, padSize * 0.22);
    ctx.fill();

    ctx.fillStyle = '#0a0a0f';
    drawRoundedRect(ctx, logoPos, logoPos, logoSize, logoSize, logoSize * 0.22);
    ctx.fill();

    var logoGradient = ctx.createLinearGradient(logoPos, logoPos, logoPos + logoSize, logoPos + logoSize);
    logoGradient.addColorStop(0, '#22d3ee');
    logoGradient.addColorStop(1, '#d946ef');
    ctx.fillStyle = logoGradient;
    ctx.font = '900 ' + Math.round(logoSize * 0.52) + 'px "Arial Black", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('AO', size / 2, size / 2 + logoSize * 0.03);

    document.getElementById('qr-target').textContent = QR_TARGET_URL;
  }

  document.getElementById('btn-download-qr').addEventListener('click', function () {
    document.getElementById('qr-canvas').toBlob(function (blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'qr-carta-after-office.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }, 'image/png');
  });

  renderQrCode();

  // ---------- Boot ----------
  loadMe()
    .then(loadMenu)
    .then(loadPopup)
    .then(loadReservationsTab)
    .catch(function (err) {
      if (err.message !== 'No autenticado') toast(err.message, 'error');
    });
})();
