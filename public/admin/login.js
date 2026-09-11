(function () {
  'use strict';

  var form = document.getElementById('login-form');
  var errorEl = document.getElementById('login-error');
  var submitBtn = document.getElementById('login-submit');
  var submitLabel = document.getElementById('login-submit-label');

  var ALERT_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';

  function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    submitLabel.innerHTML = isLoading ? '<span class="spinner"></span> Ingresando...' : 'Ingresar';
  }

  function showError(message) {
    errorEl.innerHTML = message ? ALERT_ICON + '<span>' + message + '</span>' : '';
  }

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

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    showError('');
    setLoading(true);

    var username = document.getElementById('username').value;
    var password = document.getElementById('password').value;

    fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Request': '1' },
      body: JSON.stringify({ username: username, password: password }),
    })
      .then(function (res) {
        return res.json().then(function (data) { return { ok: res.ok, data: data }; });
      })
      .then(function (result) {
        if (!result.ok) {
          showError(result.data.error || 'No se pudo iniciar sesión.');
          setLoading(false);
          return;
        }
        submitLabel.innerHTML = '<span class="spinner"></span> Listo, entrando...';
        window.location.href = './index.html';
      })
      .catch(function () {
        showError('Error de conexión. Intenta de nuevo.');
        setLoading(false);
      });
  });
})();
