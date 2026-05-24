// ============================================================
// Order page — product catalog & categories
// ============================================================

// Seeding trigger check to wipe old legacy data and re-seed Indonesian data
if (localStorage.getItem('pos_indonesian_seeded') !== 'v3') {
  localStorage.clear();
  localStorage.setItem('pos_indonesian_seeded', 'v3');
  // Set default current user
  localStorage.setItem('pos_current_user', JSON.stringify({ name: 'Agus Prasetyo', role: 'Super Admin', email: 'agus.p@bluepoint.id' }));
}

const DEFAULT_CATEGORIES = [
  { id: 'all',          name: 'Semua Menu' },
  { id: 'coffee',       name: 'Kopi' },
  { id: 'non_coffee',    name: 'Bukan Kopi' },
  { id: 'tea',          name: 'Teh & Jamu' },
  { id: 'snacks',       name: 'Jajanan Pasar' },
  { id: 'heavy_meals',  name: 'Makanan Berat' },
  { id: 'desserts',     name: 'Makanan Penutup' },
  { id: 'bakery',       name: 'Roti & Kue' },
  { id: 'packaged',     name: 'Biji Kopi & Bubuk' },
  { id: 'mocktails',    name: 'Mocktail Segar' },
  { id: 'toast',        name: 'Roti Bakar' }
];

let loadedCategories = DEFAULT_CATEGORIES;
if (localStorage.getItem('pos_categories')) {
  try {
    loadedCategories = JSON.parse(localStorage.getItem('pos_categories'));
  } catch (e) {
    console.error('Error parsing pos_categories', e);
  }
} else {
  localStorage.setItem('pos_categories', JSON.stringify(DEFAULT_CATEGORIES));
}

const CATEGORIES = loadedCategories;

window.saveCategories = function(cats) {
  localStorage.setItem('pos_categories', JSON.stringify(cats));
};

const LOW_STOCK_THRESHOLD = 5;

// Soft pastel backgrounds to make each product card feel unique
const TINTS = [
  '#FEF3C7','#FCE7F3','#DBEAFE','#D1FAE5','#FDE68A','#E0E7FF',
  '#F59E0B','#ECFDF5','#FEF2F2','#EFF6FF'
];

const PRODUCTS = [
  { id: 'p01', name: 'Es Kopi Susu Aren', emoji: '☕️', cat: 'coffee', basePrice: 18000, cogs: 5400, popularity: 99, stock: 24,
    variants: [
      { name: 'Ukuran', required: true, options: [
        { label: 'Medium', delta: 0, default: true },
        { label: 'Large', delta: 4000 }
      ]},
      { name: 'Suhu', required: true, options: [
        { label: 'Dingin', delta: 0, default: true },
        { label: 'Hangat', delta: 0 }
      ]}
    ]
  },
  { id: 'p02', name: 'Kopi Tubruk Toraja', emoji: '☕️', cat: 'coffee', basePrice: 15000, cogs: 4000, popularity: 92, stock: 18, variants: [] },
  { id: 'p03', name: 'Es Kopi Pandan', emoji: '☕️', cat: 'coffee', basePrice: 22000, cogs: 6600, popularity: 88, stock: 30, variants: [] },
  { id: 'p04', name: 'Es Teh Tarik', emoji: '🥤', cat: 'non_coffee', basePrice: 16000, cogs: 4500, popularity: 75, stock: 15, variants: [] },
  { id: 'p05', name: 'Es Kunyit Asam', emoji: '🍹', cat: 'tea', basePrice: 14000, cogs: 4000, popularity: 81, stock: 20, variants: [] },
  { id: 'p06', name: 'Pisang Goreng Madu', emoji: '🍌', cat: 'snacks', basePrice: 15000, cogs: 4500, popularity: 90, stock: 35, variants: [] },
  { id: 'p07', name: 'Nasi Goreng Kampung', emoji: '🍛', cat: 'heavy_meals', basePrice: 28000, cogs: 9000, popularity: 95, stock: 10, variants: [] },
  { id: 'p08', name: 'Es Teler Bluepoint', emoji: '🍧', cat: 'desserts', basePrice: 20000, cogs: 6000, popularity: 85, stock: 25, variants: [] },
  { id: 'p09', name: 'Roti Bakar Cokelat Keju', emoji: '🍞', cat: 'toast', basePrice: 22000, cogs: 7000, popularity: 80, stock: 16, variants: [] },
  { id: 'p10', name: 'Biji Kopi Gayo 250g', emoji: '🫘', cat: 'packaged', basePrice: 85000, cogs: 45000, popularity: 70, stock: 8, variants: [] },
  { id: 'p11', name: 'Martabak Manis', emoji: '🥞', cat: 'desserts', basePrice: 25000, cogs: 8000, popularity: 89, stock: 15,
    variants: [
      { name: 'Topik', required: true, options: [
        { label: 'Cokelat Kacang', delta: 0, default: true },
        { label: 'Keju', delta: 3000 },
        { label: 'Spesial Campur', delta: 5000 }
      ]},
      { name: 'Adonan', required: true, options: [
        { label: 'Original', delta: 0, default: true },
        { label: 'Pandan', delta: 2000 },
        { label: 'Red Velvet', delta: 3000 }
      ]}
    ]
  },
  { id: 'p12', name: 'Bakso Sapi Spesial', emoji: '🍜', cat: 'heavy_meals', basePrice: 20000, cogs: 7000, popularity: 93, stock: 22,
    variants: [
      { name: 'Tipe Mie', required: true, options: [
        { label: 'Mie Kuning', delta: 0, default: true },
        { label: 'Bihun', delta: 0 },
        { label: 'Campur', delta: 0 }
      ]},
      { name: 'Tingkat Pedas', required: true, options: [
        { label: 'Biasa', delta: 0, default: true },
        { label: 'Sedang', delta: 0 },
        { label: 'Pedas Gilak', delta: 2000 }
      ]}
    ]
  },
  { id: 'p13', name: 'Es Teh Manis Jumbo', emoji: '🥤', cat: 'tea', basePrice: 8000, cogs: 2000, popularity: 96, stock: 40,
    variants: [
      { name: 'Kemanisan', required: true, options: [
        { label: 'Normal Sugar', delta: 0, default: true },
        { label: 'Less Sugar', delta: 0 },
        { label: 'No Sugar', delta: 0 }
      ]}
    ]
  },
  { id: 'p14', name: 'Ayam Goreng Kremes', emoji: '🍗', cat: 'heavy_meals', basePrice: 22000, cogs: 8500, popularity: 91, stock: 18,
    variants: [
      { name: 'Potongan', required: true, options: [
        { label: 'Dada', delta: 0, default: true },
        { label: 'Paha Atas', delta: 0 },
        { label: 'Paha Bawah', delta: 0 }
      ]},
      { name: 'Nasi', required: true, options: [
        { label: 'Nasi Putih', delta: 0, default: true },
        { label: 'Nasi Uduk', delta: 3000 }
      ]}
    ]
  },
  { id: 'p15', name: 'Roti Bakar Bandung', emoji: '🍞', cat: 'toast', basePrice: 18000, cogs: 5000, popularity: 86, stock: 14,
    variants: [
      { name: 'Isian', required: true, options: [
        { label: 'Strawberry', delta: 0, default: true },
        { label: 'Cokelat', delta: 2000 },
        { label: 'Keju', delta: 4000 }
      ]}
    ]
  }
];

// derive stock state from numeric stock
function stockState(p) {
  if (p.stock === 0) return 'out';
  if (p.stock <= LOW_STOCK_THRESHOLD) return 'low';
  return 'in';
}

// Sanitize and normalize default products
PRODUCTS.forEach((p, i) => {
  p.tint = p.tint || TINTS[i % TINTS.length];
  p.sku = p.sku || `SKU-${p.name.toUpperCase().replace(/[^A-Z0-9]/g, '')}-${p.id.toUpperCase()}`;
  if (p.loyaltyPoints === undefined) {
    p.loyaltyPoints = Math.round(p.basePrice * 0.05); // 5% points back in IDRPOS
  }
  p.description = p.description || `${p.name} - Pilihan lezat dari menu kami.`;
  p.createdAt = p.createdAt || (Date.now() - (PRODUCTS.length - i) * 60 * 1000 * 60);
  if (!p.stocks) {
    p.stocks = {
      'Store #01': Math.round(p.stock * 0.8),
      'Store #02': Math.round(p.stock * 1.2),
      'Store #03': Math.round(p.stock * 0.5),
      'Store #04': p.stock
    };
  }
});

// Load from localStorage if present
let loadedProducts = PRODUCTS;
if (localStorage.getItem('pos_products')) {
  try {
    loadedProducts = JSON.parse(localStorage.getItem('pos_products'));
    loadedProducts.forEach((p, i) => {
      p.sku = p.sku || `SKU-${p.name.toUpperCase().replace(/[^A-Z0-9]/g, '')}-${p.id.toUpperCase()}`;
      if (p.loyaltyPoints === undefined) {
        p.loyaltyPoints = Math.round(p.basePrice * 0.05);
      }
      p.description = p.description || `${p.name} - Pilihan lezat dari menu kami.`;
      p.createdAt = p.createdAt || (Date.now() - (loadedProducts.length - i) * 60 * 1000 * 60);
      if (!p.stocks) {
        p.stocks = {
          'Store #01': Math.round((p.stock || 0) * 0.8),
          'Store #02': Math.round((p.stock || 0) * 1.2),
          'Store #03': Math.round((p.stock || 0) * 0.5),
          'Store #04': p.stock || 0
        };
      }
    });
  } catch (e) {
    console.error('Error parsing pos_products from localStorage', e);
  }
} else {
  localStorage.setItem('pos_products', JSON.stringify(PRODUCTS));
}

window.saveProducts = function(products) {
  localStorage.setItem('pos_products', JSON.stringify(products));
};

// ============================================================
// Sample customers
// ============================================================
const DEFAULT_CUSTOMERS = [
  { id: 'c01', name: 'Budi Santoso',      phone: '+62 812-3456-7890', points: 1500, since: '2024-05-12', orders: 25 },
  { id: 'c02', name: 'Siti Rahma',        phone: '+62 813-9876-5432', points: 800,  since: '2025-01-10', orders: 12 },
  { id: 'c03', name: 'Adi Wijaya',        phone: '+62 811-2233-4455', points: 3200, since: '2023-11-20', orders: 54 },
  { id: 'c04', name: 'Putri Lestari',      phone: '+62 857-7788-9900', points: 150,  since: '2026-03-15', orders: 4  },
  { id: 'c05', name: 'Bambang Hermawan',  phone: '+62 818-4455-6677', points: 2100, since: '2024-09-08', orders: 35 },
  { id: 'c06', name: 'Rizky Ramadhan',    phone: '+62 852-1122-3344', points: 450,  since: '2025-06-01', orders: 8  },
  { id: 'c07', name: 'Dewi Sartika',      phone: '+62 821-8899-0011', points: 120,  since: '2026-01-22', orders: 3  },
  { id: 'c08', name: 'Ahmad Fauzi',       phone: '+62 878-5566-7788', points: 950,  since: '2025-03-18', orders: 18 },
  { id: 'c09', name: 'Mega Utami',        phone: '+62 819-3344-5566', points: 2600, since: '2024-02-28', orders: 42 },
  { id: 'c10', name: 'Eko Prasetyo',      phone: '+62 812-7788-9900', points: 350,  since: '2025-11-05', orders: 7  }
];

let loadedCustomers = DEFAULT_CUSTOMERS;
if (localStorage.getItem('pos_customers')) {
  try {
    loadedCustomers = JSON.parse(localStorage.getItem('pos_customers'));
  } catch (e) {
    console.error('Error parsing pos_customers', e);
  }
} else {
  localStorage.setItem('pos_customers', JSON.stringify(DEFAULT_CUSTOMERS));
}

window.saveCustomers = function(custs) {
  localStorage.setItem('pos_customers', JSON.stringify(custs));
};

// ============================================================
// Sample stores & staff (pre-seeded for reports & settings)
// ============================================================
const DEFAULT_STORES = [
  { id: 's01', name: 'Store #01', address: 'GI East Mall Lantai 3, Jakarta Pusat', phone: '+62 21-2358-0101' },
  { id: 's02', name: 'Store #02', address: 'Sency Lantai LG, Jakarta Pusat', phone: '+62 21-7278-0102' },
  { id: 's03', name: 'Store #03', address: 'PIM 2 Lantai 1, Jakarta Selatan', phone: '+62 21-7592-0103' },
  { id: 's04', name: 'Store #04', address: 'MKG 3 Lantai Ground, Jakarta Utara', phone: '+62 21-4585-0104' },
  { id: 's05', name: 'Store #05', address: 'PVJ Resort Level, Bandung', phone: '+62 22-8206-0105' },
  { id: 's06', name: 'Store #06', address: 'TP 6 Lantai 5, Surabaya', phone: '+62 31-5120-0106' },
  { id: 's07', name: 'Store #07', address: 'Pakuwon Lantai LG, Surabaya', phone: '+62 31-7390-0107' },
  { id: 's08', name: 'Store #08', address: 'Sun Plaza Lantai 2, Medan', phone: '+62 61-4501-0108' },
  { id: 's09', name: 'Store #09', address: 'Beachwalk Level 1, Badung, Bali', phone: '+62 361-8464-0109' },
  { id: 's10', name: 'Store #10', address: 'TSM Lantai GF, Makassar', phone: '+62 411-8117-0110' }
];

const DEFAULT_STAFF = [
  { id: 'st01', name: 'Agus Prasetyo', role: 'Admin', email: 'agus.p@bluepoint.id', phone: '+62 812-1111-2222', stores: ['Store #01', 'Store #02', 'Store #03', 'Store #04'], active: true },
  { id: 'st02', name: 'Sri Wahyuni', role: 'Manager', email: 'sri.w@bluepoint.id', phone: '+62 813-2222-3333', stores: ['Store #04'], active: true },
  { id: 'st03', name: 'Hendra Wijaya', role: 'Cashier', email: 'hendra.w@bluepoint.id', phone: '+62 811-3333-4444', stores: ['Store #01', 'Store #02'], active: true },
  { id: 'st04', name: 'Dian Permata', role: 'Cashier', email: 'dian.p@bluepoint.id', phone: '+62 857-4444-5555', stores: ['Store #02', 'Store #03'], active: true },
  { id: 'st05', name: 'Eko Susilo', role: 'Cashier', email: 'eko.s@bluepoint.id', phone: '+62 818-5555-6666', stores: ['Store #04'], active: true },
  { id: 'st06', name: 'Fitri Handayani', role: 'Manager', email: 'fitri.h@bluepoint.id', phone: '+62 852-6666-7777', stores: ['Store #03'], active: true },
  { id: 'st07', name: 'Rian Hidayat', role: 'Cashier', email: 'rian.h@bluepoint.id', phone: '+62 821-7777-8888', stores: ['Store #05'], active: true },
  { id: 'st08', name: 'Mega Lestari', role: 'Cashier', email: 'mega.l@bluepoint.id', phone: '+62 878-8888-9999', stores: ['Store #06'], active: true },
  { id: 'st09', name: 'Doni Setiawan', role: 'Cashier', email: 'doni.s@bluepoint.id', phone: '+62 819-9999-0000', stores: ['Store #07'], active: true },
  { id: 'st10', name: 'Yanti Sulistyo', role: 'Cashier', email: 'yanti.s@bluepoint.id', phone: '+62 812-0000-1111', stores: ['Store #09'], active: true }
];

if (!localStorage.getItem('pos_stores')) {
  localStorage.setItem('pos_stores', JSON.stringify(DEFAULT_STORES));
}
if (!localStorage.getItem('pos_staff')) {
  localStorage.setItem('pos_staff', JSON.stringify(DEFAULT_STAFF));
}

// Seed sample orders (with details and histories) if pos_orders is empty
if (!localStorage.getItem('pos_orders')) {
  const seedOrders = [
    {
      id: 'ORD-10001',
      date: '2026-05-22T08:30:00.000Z',
      customerId: 'c01',
      customerName: 'Budi Santoso',
      store: 'Store #04 (POS)',
      items: [
        { id: 'p03', name: 'Es Kopi Pandan', qty: 2, price: 22000, total: 44000 },
        { id: 'p11', name: 'Martabak Manis', variantKey: 'Topik:Keju,Adonan:Red Velvet', variantText: 'Keju · Red Velvet', qty: 1, price: 31000, total: 31000 }
      ],
      paymentMethod: 'qr',
      subtotal: 75000,
      itemDiscount: 0,
      promoDiscount: 7500,
      promoCode: 'KOPIPAGI',
      tax: 6750,
      total: 74250,
      pointsEarned: 74,
      pointsRedeemed: 0,
      itemCount: 3
    },
    {
      id: 'ORD-10002',
      date: '2026-05-22T10:15:00.000Z',
      customerId: 'c02',
      customerName: 'Siti Rahma',
      store: 'Store #04 (POS)',
      items: [
        { id: 'p01', name: 'Es Kopi Susu Aren', variantKey: 'Ukuran:Large,Suhu:Dingin', variantText: 'Large · Dingin', qty: 5, price: 22000, total: 110000 },
        { id: 'p12', name: 'Bakso Sapi Spesial', variantKey: 'Tipe Mie:Bihun,Tingkat Pedas:Pedas Gilak', variantText: 'Bihun · Pedas Gilak', qty: 2, price: 22000, total: 44000 }
      ],
      paymentMethod: 'cash',
      subtotal: 154000,
      itemDiscount: 0,
      promoDiscount: 10000,
      promoCode: 'GAJIANSERU',
      tax: 14400,
      total: 158400,
      pointsEarned: 158,
      pointsRedeemed: 0,
      itemCount: 7
    },
    {
      id: 'ORD-10003',
      date: '2026-05-22T11:45:00.000Z',
      customerId: null,
      customerName: 'Walk-in',
      store: 'Store #04 (POS)',
      items: [
        { id: 'p13', name: 'Es Teh Manis Jumbo', variantKey: 'Kemanisan:Less Sugar', variantText: 'Less Sugar', qty: 3, price: 8000, total: 24000 },
        { id: 'p14', name: 'Ayam Goreng Kremes', variantKey: 'Potongan:Dada,Nasi:Nasi Uduk', variantText: 'Dada · Nasi Uduk', qty: 2, price: 25000, total: 50000 }
      ],
      paymentMethod: 'qr',
      subtotal: 74000,
      itemDiscount: 0,
      promoDiscount: 0,
      promoCode: '',
      tax: 7400,
      total: 81400,
      pointsEarned: 0,
      pointsRedeemed: 0,
      itemCount: 5
    },
    {
      id: 'ORD-10004',
      date: '2026-05-21T14:20:00.000Z',
      customerId: 'c03',
      customerName: 'Adi Wijaya',
      store: 'Store #01',
      items: [
        { id: 'p10', name: 'Biji Kopi Gayo 250g', qty: 2, price: 85000, total: 170000 }
      ],
      paymentMethod: 'card',
      subtotal: 170000,
      itemDiscount: 0,
      promoDiscount: 34000,
      promoCode: 'MEMBERBARU',
      tax: 13600,
      total: 149600,
      pointsEarned: 149,
      pointsRedeemed: 0,
      itemCount: 2
    },
    {
      id: 'ORD-10005',
      date: '2026-05-21T16:40:00.000Z',
      customerId: 'c04',
      customerName: 'Putri Lestari',
      store: 'Store #02',
      items: [
        { id: 'p05', name: 'Es Kunyit Asam', qty: 3, price: 14000, total: 42000 },
        { id: 'p15', name: 'Roti Bakar Bandung', variantKey: 'Isian:Keju', variantText: 'Keju', qty: 1, price: 22000, total: 22000 }
      ],
      paymentMethod: 'qr',
      subtotal: 64000,
      itemDiscount: 0,
      promoDiscount: 0,
      promoCode: '',
      tax: 6400,
      total: 70400,
      pointsEarned: 70,
      pointsRedeemed: 0,
      itemCount: 4
    },
    {
      id: 'ORD-10006',
      date: '2026-05-19T09:15:00.000Z',
      customerId: 'c05',
      customerName: 'Bambang Hermawan',
      store: 'Store #04 (POS)',
      items: [
        { id: 'p01', name: 'Es Kopi Susu Aren', qty: 4, price: 18000, total: 72000 },
        { id: 'p06', name: 'Pisang Goreng Madu', qty: 4, price: 15000, total: 60000 }
      ],
      paymentMethod: 'qr',
      subtotal: 132000,
      itemDiscount: 0,
      promoDiscount: 33000,
      promoCode: 'FLASHSALE',
      tax: 9900,
      total: 108900,
      pointsEarned: 108,
      pointsRedeemed: 0,
      itemCount: 8
    },
    {
      id: 'ORD-10007',
      date: '2026-05-18T15:30:00.000Z',
      customerId: null,
      customerName: 'Walk-in',
      store: 'Store #02',
      items: [
        { id: 'p04', name: 'Es Teh Tarik', qty: 1, price: 16000, total: 16000 },
        { id: 'p09', name: 'Roti Bakar Cokelat Keju', qty: 1, price: 22000, total: 22000 }
      ],
      paymentMethod: 'cash',
      subtotal: 38000,
      itemDiscount: 0,
      promoDiscount: 0,
      promoCode: '',
      tax: 3800,
      total: 41800,
      pointsEarned: 0,
      pointsRedeemed: 0,
      itemCount: 2
    },
    {
      id: 'ORD-10008',
      date: '2026-05-15T12:00:00.000Z',
      customerId: 'c06',
      customerName: 'Rizky Ramadhan',
      store: 'Store #02',
      items: [
        { id: 'p07', name: 'Nasi Goreng Kampung', qty: 2, price: 28000, total: 56000 },
        { id: 'p05', name: 'Es Kunyit Asam', qty: 2, price: 14000, total: 28000 }
      ],
      paymentMethod: 'qr',
      subtotal: 84000,
      itemDiscount: 0,
      promoDiscount: 0,
      promoCode: '',
      tax: 8400,
      total: 92400,
      pointsEarned: 92,
      pointsRedeemed: 0,
      itemCount: 4
    },
    {
      id: 'ORD-10009',
      date: '2026-05-10T11:00:00.000Z',
      customerId: 'c08',
      customerName: 'Ahmad Fauzi',
      store: 'Store #01',
      items: [
        { id: 'p02', name: 'Kopi Tubruk Toraja', qty: 3, price: 15000, total: 45000 }
      ],
      paymentMethod: 'cash',
      subtotal: 45000,
      itemDiscount: 0,
      promoDiscount: 4500,
      promoCode: 'KOPIPAGI',
      tax: 4050,
      total: 44550,
      pointsEarned: 44,
      pointsRedeemed: 0,
      itemCount: 3
    },
    {
      id: 'ORD-10010',
      date: '2026-05-05T14:45:00.000Z',
      customerId: 'c09',
      customerName: 'Mega Utami',
      store: 'Store #03',
      items: [
        { id: 'p03', name: 'Es Kopi Pandan', qty: 1, price: 22000, total: 22000 },
        { id: 'p08', name: 'Es Teler Bluepoint', qty: 1, price: 20000, total: 20000 }
      ],
      paymentMethod: 'card',
      subtotal: 42000,
      itemDiscount: 0,
      promoDiscount: 0,
      promoCode: '',
      tax: 4200,
      total: 46200,
      pointsEarned: 46,
      pointsRedeemed: 0,
      itemCount: 2
    }
  ];
  localStorage.setItem('pos_orders', JSON.stringify(seedOrders));
}

// Seed default promos
const DEFAULT_PROMOS = {
  'MERDEKA17':  { kind: 'percent', value: 0.17, description: 'Diskon Kemerdekaan 17%' },
  'GAJIANSERU': { kind: 'amount',  value: 10000, description: 'Promo Gajian Rp 10rb' },
  'KOPIPAGI':   { kind: 'percent', value: 0.10, description: 'Kopi Pagi Diskon 10%' },
  'MAKANHEMAT': { kind: 'amount',  value: 5000,  description: 'Potongan Makan Rp 5rb' },
  'JUMATBERKAH':{ kind: 'percent', value: 0.15, description: 'Jumat Berkah Diskon 15%' },
  'MEMBERBARU': { kind: 'percent', value: 0.20, description: 'Diskon Member Baru 20%' },
  'DISKONAJAH': { kind: 'amount',  value: 2000,  description: 'Potongan Rp 2rb' },
  'FLASHSALE':  { kind: 'percent', value: 0.25, description: 'Flash Sale Diskon 25%' },
  'RAMADHAN':   { kind: 'percent', value: 0.15, description: 'Berkah Ramadhan 15%' },
  'STAFF10':    { kind: 'percent', value: 0.10, description: 'Diskon Khusus Staff 10%' }
};

if (!localStorage.getItem('pos_promos')) {
  localStorage.setItem('pos_promos', JSON.stringify(DEFAULT_PROMOS));
}

const DEFAULT_FINANCE_CONFIG = {
  dailySalaries: 3000000,
  dailyRent: 2000000,
  dailyUtilities: 500000,
  taxRate: 10,
  taxApplyTo: 'revenue',
  targetGrossMargin: 65,
  targetOperatingMargin: 30,
  targetNetMargin: 15,
  alertsEnabled: true
};

if (!localStorage.getItem('pos_finance_config')) {
  localStorage.setItem('pos_finance_config', JSON.stringify(DEFAULT_FINANCE_CONFIG));
}

window.POS_DATA = { CATEGORIES, PRODUCTS: loadedProducts, CUSTOMERS: loadedCustomers, LOW_STOCK_THRESHOLD, stockState };

// Sidebar profile interactions and dynamic updates
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const sideUser = document.querySelector('.side-user');
    if (!sideUser) return;

    sideUser.style.cursor = 'pointer';
    sideUser.addEventListener('click', () => {
      window.location.href = 'setting.html';
    });

    const user = JSON.parse(localStorage.getItem('pos_current_user')) || {
      name: 'Agus Prasetyo',
      role: 'Super Admin',
      email: 'agus.p@bluepoint.id',
      store: 'Store #04',
      phone: '+62 812-1111-2222'
    };

    const avatarEl = sideUser.querySelector('.avatar');
    const nameEl = sideUser.querySelector('.name');
    const roleEl = sideUser.querySelector('.role');

    if (nameEl) nameEl.textContent = user.name;
    if (roleEl) roleEl.textContent = `${user.role} · ${user.store || 'Store #04'}`;

    if (avatarEl) {
      const nameParts = user.name.split(/\s+/).filter(Boolean).slice(0, 2);
      const initials = nameParts.map(s => s[0].toUpperCase()).join('');
      avatarEl.textContent = initials || 'SA';
    }
  });
}
