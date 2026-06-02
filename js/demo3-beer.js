function initDemo3BeerBoard() {
  var board = document.getElementById('beer-board');
  var detail = document.getElementById('beer-detail');
  if (!board || !detail) return;
  var beers = {
    ipa: { name: 'IPA Cítrica del Sur', brewery: 'Cervecería Patagonia Craft', abv: '6.2% ABV · 45 IBU', desc: 'Lúpulo Cascade y Citra. Pomelo, pino y final seco.', price: '$4.990' },
    stout: { name: 'Stout Ahumada', brewery: 'Barrica Urbana', abv: '5.8% ABV · 32 IBU', desc: 'Malta torrada, café y cacao. Cremosa y oscura.', price: '$4.590' },
    lager: { name: 'Lager After Five', brewery: 'House Brew After Office', abv: '4.5% ABV · 18 IBU', desc: 'Refrescante y limpia. Ideal para brindar al salir de la oficina.', price: '$3.990' },
    sour: { name: 'Sour Berries', brewery: 'Fermentos del Valle', abv: '4.8% ABV · 12 IBU', desc: 'Frutos rojos, ácida y vibrante. Solo este mes.', price: '$5.290' },
    weizen: { name: 'Weizen Niebla', brewery: 'Cervecería del Puerto', abv: '5.0% ABV · 15 IBU', desc: 'Trigo maltoso, plátano y clavo. Jarra 500ml.', price: '$4.290' },
    amber: { name: 'Ámbar Cobre', brewery: 'Taller del Lúpulo', abv: '5.4% ABV · 28 IBU', desc: 'Caramelo y amargor moderado. La favorita los viernes.', price: '$4.190' }
  };
  function select(key) {
    var data = beers[key];
    if (!data) return;
    board.querySelectorAll('[data-beer-item]').forEach(function (i) {
      i.classList.remove('ring-2', 'ring-orange-500', 'bg-orange-500/20');
    });
    var active = board.querySelector('[data-beer-item="' + key + '"]');
    if (active) active.classList.add('ring-2', 'ring-orange-500', 'bg-orange-500/20');
    detail.innerHTML =
      '<p class="chalk-text text-2xl md:text-3xl mb-2">' + data.name + '</p>' +
      '<p class="text-orange-400 text-sm font-semibold uppercase tracking-wider mb-2">' + data.brewery + '</p>' +
      '<p class="text-stone-400 text-sm mb-2">' + data.abv + '</p>' +
      '<p class="text-stone-300 mb-4">' + data.desc + '</p>' +
      '<p class="chalk-text text-3xl text-amber-400">' + data.price + ' <span class="text-lg text-stone-500">/ schop</span></p>';
  }
  board.querySelectorAll('[data-beer-item]').forEach(function (item) {
    item.addEventListener('click', function () { select(item.getAttribute('data-beer-item')); });
  });
  select('ipa');
}
