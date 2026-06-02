function initDemo1Menu() {
  var container = document.getElementById('demo1-menu-tabs');
  if (!container) return;
  var tabs = container.querySelectorAll('[data-menu-tab]');
  var panels = container.querySelectorAll('[data-menu-panel]');
  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var id = tab.getAttribute('data-menu-tab');
      tabs.forEach(function (t) {
        t.classList.remove('border-amber-500', 'text-amber-400', 'bg-amber-500/10');
        t.classList.add('border-transparent', 'text-stone-400');
      });
      tab.classList.add('border-amber-500', 'text-amber-400', 'bg-amber-500/10');
      tab.classList.remove('border-transparent', 'text-stone-400');
      panels.forEach(function (p) {
        p.classList.toggle('hidden', p.getAttribute('data-menu-panel') !== id);
      });
    });
  });
}
