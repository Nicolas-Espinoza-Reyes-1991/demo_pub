var MENU_BY_DEMO = {
  '1': {
    tabs: [
      { id: 'cocteleria', label: 'Coctelería' },
      { id: 'cervezas', label: 'Cervezas' },
      { id: 'hamburguesas', label: 'Hamburguesas' },
      { id: 'tablas', label: 'Tablas' }
    ],
    items: {
      cocteleria: [
        { name: 'Old Fashioned', desc: 'Bourbon, angostura, azúcar morena', price: '$8.990', img: 'photo-1598994671512-395d7a6147e0 (2).jpg', tags: ['clásico', 'whisky'] },
        { name: 'Negroni Clásico', desc: 'Gin, Campari, vermut rosso', price: '$7.990', img: 'photo-1626201853293-d39a9fca6c3d.jpg', tags: ['gin', 'amargo'] },
        { name: 'Espresso Martini', desc: 'Vodka, licor de café, espresso', price: '$8.490', img: 'photo-1745052811236-a56a0f8718d1.jpg', tags: ['vodka', 'café'] },
        { name: 'Whisky Sour', desc: 'Bourbon, limón, clara, bitter', price: '$7.490', img: 'photo-1745052838929-39e6579e130e.jpg', tags: ['whisky', 'cítrico'] },
        { name: 'Pisco Sour Futrono', desc: 'Pisco, limón, amargo de angostura', price: '$6.990', img: 'photo-1598994671512-395d7a6147e0 (2).jpg', tags: ['pisco', 'local'] },
        { name: 'Moscow Mule', desc: 'Vodka, ginger beer, lima', price: '$6.490', img: 'photo-1626201853293-d39a9fca6c3d.jpg', tags: ['vodka', 'refrescante'] }
      ],
      cervezas: [
        { name: 'Schop After Five', desc: 'Lager house · 500 ml', price: '$3.990', img: 'photo-1551810058-a88784bc3381 (2).jpg', tags: ['lager', 'schop'] },
        { name: 'IPA Cítrica del Sur', desc: '6.2% ABV · lúpulo Cascade', price: '$4.990', img: 'photo-1551810058-a88784bc3381 (2).jpg', tags: ['ipa', 'craft'] },
        { name: 'Stout Ahumada', desc: 'Malta torrada, café, cacao', price: '$4.590', img: 'photo-1551810058-a88784bc3381 (2).jpg', tags: ['stout', 'oscura'] },
        { name: 'Weizen Niebla', desc: 'Trigo maltoso · jarra 500 ml', price: '$4.290', img: 'photo-1551810058-a88784bc3381 (2).jpg', tags: ['trigo', 'schop'] },
        { name: 'Sour Berries', desc: 'Frutos rojos · edición mes', price: '$5.290', img: 'photo-1551810058-a88784bc3381 (2).jpg', tags: ['sour', 'frutal'] }
      ],
      hamburguesas: [
        { name: 'Burger Signature', desc: 'Angus, cheddar ahumado, cebolla caramelizada', price: '$11.990', img: 'photo-1626203046629-88de33a823c8 (2).jpg', tags: ['angus', 'premium'] },
        { name: 'Classic After Office', desc: 'Doble carne, lechuga, tomate, salsa house', price: '$9.990', img: 'photo-1644447381290-85358ae625cb.jpg', tags: ['clásica'] },
        { name: 'BBQ Bacon', desc: 'Salsa BBQ, bacon crocante, cebolla morada', price: '$10.990', img: 'photo-1626203046629-88de33a823c8 (2).jpg', tags: ['bbq', 'bacon'] },
        { name: 'Slider Pack x3', desc: 'Mini burgers con papas rústicas', price: '$10.490', img: 'photo-1644447381290-85358ae625cb.jpg', tags: ['para compartir'] }
      ],
      tablas: [
        { name: 'Tabla After Office', desc: 'Carnes curadas, quesos, aceitunas, panes', price: '$18.990', img: 'photo-1644447393594-86ac32d94a09.jpg', tags: ['premium', 'compartir'] },
        { name: 'Tabla de Quesos', desc: 'Selección nacional e importada', price: '$14.990', img: 'photo-1644447393594-86ac32d94a09.jpg', tags: ['quesos'] },
        { name: 'Nachos Deluxe', desc: 'Guacamole, pico de gallo, crema agria', price: '$9.490', img: 'photo-1644447338949-b2538f4063c0 (2).jpg', tags: ['snack'] },
        { name: 'Pizza Prosciutto', desc: 'Masa madre, rúcula, parmesano', price: '$12.990', img: 'photo-1644447381290-85358ae625cb.jpg', tags: ['pizza'] }
      ]
    }
  },
  '2': {
    tabs: [
      { id: 'cocteles', label: 'Cocteles Neón' },
      { id: 'shots', label: 'Shots & Tragos' },
      { id: 'comida', label: 'Comida Nocturna' }
    ],
    items: {
      cocteles: [
        { name: 'Electric Blue', desc: 'Vodka, curaçao, limón, LED cube', price: '$6.990', img: 'photo-1626201853293-d39a9fca6c3d.jpg', tags: ['uv', 'signature'] },
        { name: 'Pink Plasma', desc: 'Gin, frambuesa, prosecco', price: '$7.490', img: 'photo-1745052811236-a56a0f8718d1.jpg', tags: ['gin', 'frutal'] },
        { name: 'Cyber Mule', desc: 'Vodka, ginger beer, lima', price: '$5.990', img: 'photo-1598994671512-395d7a6147e0 (2).jpg', tags: ['refrescante'] },
        { name: 'Neon Sour', desc: 'Pisco, maracuyá, espuma cítrica', price: '$6.490', img: 'photo-1745052838929-39e6579e130e.jpg', tags: ['pisco', 'ácido'] },
        { name: 'Midnight Espresso', desc: 'Vodka, licor de café, cold brew', price: '$7.990', img: 'photo-1745052811236-a56a0f8718d1.jpg', tags: ['café', 'nocturno'] }
      ],
      shots: [
        { name: 'Shots Pack x6', desc: 'Sabores surtidos de la casa', price: '$12.990', img: 'photo-1745052838929-39e6579e130e.jpg', tags: ['pack', 'fiesta'] },
        { name: 'Glow Tequila', desc: 'Tequila blanco, curaçao, lima', price: '$3.990', img: 'photo-1626201853293-d39a9fca6c3d.jpg', tags: ['tequila', 'uv'] },
        { name: 'Fuchsia Gin', desc: 'Gin, bitter rosado, tonic', price: '$4.490', img: 'photo-1745052811236-a56a0f8718d1.jpg', tags: ['gin'] },
        { name: 'Cyan Vodka', desc: 'Vodka, blue curaçao, sprite', price: '$3.790', img: 'photo-1598994671512-395d7a6147e0 (2).jpg', tags: ['vodka'] }
      ],
      comida: [
        { name: 'Nachos UV', desc: 'Queso fundido, jalapeños, guacamole', price: '$9.990', img: 'photo-1644447338949-b2538f4063c0 (2).jpg', tags: ['snack', 'compartir'] },
        { name: 'Slider Neon', desc: '×3 mini burgers, salsa secreta', price: '$10.990', img: 'photo-1626203046629-88de33a823c8 (2).jpg', tags: ['burgers'] },
        { name: 'Papas Loaded', desc: 'Cheddar, bacon, sour cream', price: '$8.490', img: 'photo-1644447381290-85358ae625cb.jpg', tags: ['papas'] },
        { name: 'Tabla Midnight', desc: 'Fiambres, quesos, dips UV', price: '$15.990', img: 'photo-1644447393594-86ac32d94a09.jpg', tags: ['tabla'] }
      ]
    }
  },
  '3': {
    tabs: [
      { id: 'cervezas', label: 'Cervezas' },
      { id: 'pub', label: 'Pub Food' },
      { id: 'tablas', label: 'Para Compartir' }
    ],
    items: {
      cervezas: [
        { name: 'IPA Cítrica del Sur', desc: '6.2% ABV · 45 IBU · Cascade & Citra', price: '$4.990', img: 'photo-1551810058-a88784bc3381 (2).jpg', tags: ['ipa', 'craft'] },
        { name: 'Stout Ahumada', desc: '5.8% ABV · malta torrada, café, cacao', price: '$4.590', img: 'photo-1551810058-a88784bc3381 (2).jpg', tags: ['stout'] },
        { name: 'Lager After Five', desc: '4.5% ABV · house brew refrescante', price: '$3.990', img: 'photo-1551810058-a88784bc3381 (2).jpg', tags: ['lager', 'schop'] },
        { name: 'Sour Berries', desc: '4.8% ABV · frutos rojos · edición mes', price: '$5.290', img: 'photo-1551810058-a88784bc3381 (2).jpg', tags: ['sour'] },
        { name: 'Weizen Niebla', desc: '5.0% ABV · trigo · jarra 500 ml', price: '$4.290', img: 'photo-1551810058-a88784bc3381 (2).jpg', tags: ['weizen'] },
        { name: 'Ámbar Cobre', desc: '5.4% ABV · caramelo y amargor moderado', price: '$4.190', img: 'photo-1551810058-a88784bc3381 (2).jpg', tags: ['ámbar'] }
      ],
      pub: [
        { name: 'Burger Signature', desc: 'Angus, cheddar ahumado, cebolla caramelizada', price: '$11.990', img: 'photo-1626203046629-88de33a823c8 (2).jpg', tags: ['burger'] },
        { name: 'Classic After Office', desc: 'Doble carne, lechuga, tomate, salsa house', price: '$9.990', img: 'photo-1644447381290-85358ae625cb.jpg', tags: ['clásica'] },
        { name: 'Fish & Chips', desc: 'Merluza empanizada, papas rústicas', price: '$10.490', img: 'photo-1644447381290-85358ae625cb.jpg', tags: ['pescado'] },
        { name: 'Pizza Prosciutto', desc: 'Masa madre, rúcula, parmesano', price: '$12.990', img: 'photo-1644447381290-85358ae625cb.jpg', tags: ['pizza'] }
      ],
      tablas: [
        { name: 'Tabla After Office', desc: 'Carnes curadas, quesos, aceitunas', price: '$18.990', img: 'photo-1644447393594-86ac32d94a09.jpg', tags: ['premium'] },
        { name: 'Nachos Deluxe', desc: 'Guacamole, pico de gallo, crema agria', price: '$9.490', img: 'photo-1644447338949-b2538f4063c0 (2).jpg', tags: ['snack'] },
        { name: 'Alitas BBQ x12', desc: 'Salsa ahumada o picante', price: '$9.990', img: 'photo-1644447381290-85358ae625cb.jpg', tags: ['alitas'] },
        { name: 'Papas Rústicas', desc: 'Ajo, romero, dip de la casa', price: '$5.990', img: 'photo-1644447338949-b2538f4063c0 (2).jpg', tags: ['papas'] }
      ]
    }
  }
};

/* Compat legacy */
var MENU_DATA = MENU_BY_DEMO['1'].items;
