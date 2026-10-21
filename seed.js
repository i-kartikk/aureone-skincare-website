// Initial content for data/db.json. Only used when the database file does not exist yet.
const img = name => `/assets/img/${name}`;

module.exports = function seed(hashPassword) {
  const now = new Date().toISOString();
  const products = [
    {
      name: 'Rice Veil',
      subtitle: 'Gentle Daily Face Wash',
      category: 'Cleanse',
      price: 649, comparePrice: 799, size: '100 ml', stock: 120,
      variants: [
        { size: '50 ml', price: 399, comparePrice: 499, stock: 60 },
        { size: '100 ml', price: 649, comparePrice: 799, stock: 120 }
      ],
      tagline: 'Hydrate, Soothe, Prepare',
      description: 'A soft, low-foam daily face wash that lifts away dirt, oil and impurities without stripping. Fine natural rice particles gently polish while panthenol and glycerin hydrate, soothe, and prepare your skin for active care.',
      benefits: ['Hydrate, Soothe, Prepare', 'Gentle low-foam cleanse', 'Maintains moisture balance', 'Softens and clarifies'],
      ingredients: [
        { name: 'Rice Extract', note: 'Nourishes and enhances natural radiance.' },
        { name: 'Panthenol', note: 'Soothes and supports the skin barrier.' },
        { name: 'Glycerin', note: 'Draws in and holds moisture.' }
      ],
      howToUse: 'Massage a small amount onto damp skin, morning and evening. Rinse thoroughly with lukewarm water.',
      skinTypes: 'All skin types · Unisex',
      images: [img('rice-veil-1.jpg'), img('range-square-1.jpg')],
      featured: true
    },
    {
      name: 'Radiance 5',
      subtitle: 'Niacinamide Brightening Serum',
      category: 'Treat',
      price: 899, comparePrice: 1099, size: '30 ml', stock: 90,
      variants: [
        { size: '15 ml', price: 549, comparePrice: 649, stock: 45 },
        { size: '30 ml', price: 899, comparePrice: 1099, stock: 90 }
      ],
      tagline: 'Balance, Brighten, Refine',
      description: 'A lightweight, fast-absorbing serum designed to help improve the appearance of the tone, excess oil & dull looking skin — promoting clearer, balanced, and radiant-looking skin.',
      benefits: ['Balance, Brighten, Refine', 'Help improve the appearance of the tone', 'Balances excess oil', 'Revives dull looking skin', 'Supports barrier'],
      ingredients: [
        { name: 'Niacinamide 5%', note: 'Helps control excess oil, evens skin tone and supports the barrier.' },
        { name: 'Rice Extract', note: 'Nourishes and enhances natural radiance.' },
        { name: 'Panthenol 2%', note: 'Soothes and hydrates the skin.' },
        { name: 'Sodium Hyaluronate', note: 'Provides deep hydration and plumps the skin.' }
      ],
      howToUse: 'Apply a few drops on clean skin, morning and evening. Follow with moisturizer.',
      skinTypes: 'All skin types',
      images: [img('radiance-5-1.jpg'), img('radiance-5-2.jpg'), img('radiance-5-3.jpg'), img('radiance-5-4.jpg')],
      featured: true
    },
    {
      name: 'Velvet Barrier',
      subtitle: 'Barrier Repair Moisturizer',
      category: 'Moisturiser',
      price: 999, comparePrice: 1199, size: '50 gm', stock: 80,
      variants: [
        { size: '25 gm', price: 599, comparePrice: 699, stock: 55 },
        { size: '50 gm', price: 999, comparePrice: 1199, stock: 80 }
      ],
      tagline: 'Nourish, Protect, Strengthen',
      description: 'A rich yet lightweight barrier repair moisturizer designed to deeply hydrate, nourish, protect, and strengthen the skin barrier for velvety-soft, healthy skin.',
      benefits: ['Hydrate', 'Nourish, Protect, Strengthen', 'Strengthens barrier', 'Soothes & calms redness', 'Deep lasting moisture'],
      ingredients: [
        { name: 'Ceramides', note: 'Help repair and maintain a healthy skin barrier.' },
        { name: 'Squalane', note: 'Lightweight, skin-identical nourishment.' },
        { name: 'Panthenol', note: 'Soothes irritation and redness.' },
        { name: 'Hyaluronic Acid', note: 'Long-lasting moisture.' }
      ],
      howToUse: 'Apply a small amount on clean skin, morning and evening. Gently massage until absorbed.',
      skinTypes: 'All skin types',
      images: [img('velvet-barrier-1.jpg'), img('velvet-barrier-2.jpg'), img('velvet-barrier-3.jpg')],
      featured: true
    },
    {
      name: 'Solar Veil',
      subtitle: 'Daily Sunscreen SPF 50 PA++++',
      category: 'Protect',
      price: 799, comparePrice: 949, size: '50 gm', stock: 110,
      variants: [
        { size: '25 gm', price: 449, comparePrice: 549, stock: 70 },
        { size: '50 gm', price: 799, comparePrice: 949, stock: 110 }
      ],
      tagline: 'Shield, Defend, Preserve',
      description: 'A lightweight, non-greasy broad spectrum sunscreen that protects from UVA and UVB rays while ceramides and vitamin E care for the skin. Comfortable, invisible everyday wear.',
      benefits: ['Shield, Defend, Preserve', 'UVA | UVB SPF 50 PA++++', 'Prevents sun damage', 'Keeps skin even-toned', 'Lightweight, non-greasy'],
      ingredients: [
        { name: 'Ceramides', note: 'Support the skin barrier.' },
        { name: 'Squalane', note: 'Weightless comfort.' },
        { name: 'Panthenol', note: 'Soothes and hydrates.' },
        { name: 'Vitamin E', note: 'Antioxidant protection.' }
      ],
      howToUse: 'Apply generously as the last step of your morning routine, 15 minutes before sun exposure. Reapply every 2–3 hours.',
      skinTypes: 'All skin types',
      images: [img('solar-veil-1.jpg'), img('range-square-2.jpg')],
      featured: true
    },
    {
      name: 'Lumière',
      subtitle: 'Vit C Radiance Serum',
      category: 'Glow',
      price: 1099, comparePrice: 1299, size: '30 ml', stock: 75,
      variants: [
        { size: '15 ml', price: 649, comparePrice: 799, stock: 40 },
        { size: '30 ml', price: 1099, comparePrice: 1299, stock: 75 }
      ],
      tagline: 'Glow, Brighten, Revitalize',
      description: 'A powerful antioxidant serum infused with pure Vitamin C to help in glow, brightens dull skin tone, and protects against environmental stressors for lasting radiance.',
      benefits: ['Vit C Help in glow, Bright', 'Illuminates & protects', 'Brightens dull skin tone', 'Hydrates & renews'],
      ingredients: [
        { name: 'Vitamin C (3-O Ethyl Ascorbic Acid)', note: 'Brightens, boosts radiance and helps even skin tone.' },
        { name: 'Ferulic Acid', note: 'Enhances antioxidant protection and stability.' },
        { name: 'Vitamin E', note: 'Nourishes and protects the skin barrier.' },
        { name: 'Hyaluronic Acid', note: 'Deeply hydrates and plumps the skin.' }
      ],
      howToUse: 'Apply 2–3 drops on clean skin, morning and/or evening. Follow with moisturizer and sunscreen (AM).',
      skinTypes: 'All skin types',
      images: [img('lumiere-c-1.jpg'), img('range-tall-1.jpg')],
      featured: true
    },
    {
      name: 'Aqua Balance',
      subtitle: 'Niacinamide 5% + Hyaluronic Acid Face Serum',
      category: 'Treat',
      price: 849, comparePrice: 999, size: '30 ml', stock: 60,
      variants: [
        { size: '15 ml', price: 499, comparePrice: 599, stock: 35 },
        { size: '30 ml', price: 849, comparePrice: 999, stock: 60 }
      ],
      tagline: 'Hydrate. Balance. Calm.',
      description: 'A water-light serum that pairs niacinamide with hyaluronic acid to rebalance oil, calm the skin and flood it with hydration — for clear, healthy and balanced skin.',
      benefits: ['Hydrate', 'Balance', 'Calm'],
      ingredients: [
        { name: 'Niacinamide 5%', note: 'Balances oil and refines the look of pores.' },
        { name: 'Hyaluronic Acid', note: 'Multi-depth hydration.' }
      ],
      howToUse: 'Apply 2–3 drops to clean skin, morning and evening, before moisturizer.',
      skinTypes: 'All skin types',
      images: [img('aqua-balance-1.jpg')],
      featured: false
    },
    {
      name: 'Radiance C',
      subtitle: 'Vitamin C Serum',
      category: 'Treat',
      price: 1049, comparePrice: 1249, size: '30 ml', stock: 55,
      variants: [
        { size: '15 ml', price: 649, comparePrice: 749, stock: 30 },
        { size: '30 ml', price: 1049, comparePrice: 1249, stock: 55 }
      ],
      tagline: 'For brighter, healthier & glowing skin.',
      description: 'A potent vitamin C serum with L-ascorbic acid and hyaluronic acid that boosts radiance, evens tone and defends the skin with antioxidant care.',
      benefits: ['Radiance', 'Even tone', 'Antioxidant'],
      ingredients: [
        { name: 'L-Ascorbic Acid', note: 'Pure vitamin C for visible radiance.' },
        { name: 'Hyaluronic Acid', note: 'Keeps skin plump and hydrated.' }
      ],
      howToUse: 'Apply 2–3 drops in the morning on clean skin. Always follow with sunscreen.',
      skinTypes: 'All skin types',
      images: [img('radiance-c-1.jpg')],
      featured: false
    }
  ].map((p, i) => ({
    id: `p${i + 1}`,
    slug: p.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
    active: true,
    createdAt: now,
    updatedAt: now,
    ...p
  }));

  return {
    admin: {
      username: process.env.ADMIN_USERNAME || 'admin',
      password: hashPassword(process.env.ADMIN_PASSWORD || 'aureone@123')
    },
    settings: {
      brandName: 'AUREONÉ',
      tagline: 'The Art of Radiance',
      announcement: 'Skin that looks luminous, feels balanced & belongs to you · Complimentary shipping above ₹999',
      heroEyebrow: 'Purposeful Skincare · Real Radiance',
      heroTitle: 'The ritual behind healthy skin.',
      heroSubtitle: 'Skin that looks luminous, feels balanced & belongs to you. We don\'t formulate for a moment of glow — we formulate for the ritual behind healthy skin: purposeful ingredients, consistent care and lasting radiance.',
      heroImage: img('hero-ritual-bottles.jpg'),
      story: 'A Brighter You',
      logo: img('monogram.png'),
      aboutTitle: 'The Art of Radiance.',
      aboutText: 'AUREONÉ is not about adding more products to a skincare shelf. It is about creating purposeful skincare rituals for healthier, more radiant skin.',
      aboutImage: img('range-tall-2.jpg'),
      currency: '₹',
      freeShippingThreshold: 999,
      shippingFee: 79,
      contactEmail: 'hello@aureone.com',
      contactPhone: '+91 98765 43210',
      address: 'Mumbai, India',
      instagram: 'https://instagram.com/',
      facebook: 'https://facebook.com/'
    },
    products,
    orders: [],
    messages: [],
    subscribers: [],
    reviews: [
      { id: 'r1', name: 'Ananya S.', text: 'Radiance 5 has genuinely changed my skin. Less oil by noon and my tone looks so much more even.', rating: 5, product: 'Radiance 5' },
      { id: 'r2', name: 'Rhea M.', text: 'Velvet Barrier is the most comforting moisturizer I have used — rich but never heavy.', rating: 5, product: 'Velvet Barrier' },
      { id: 'r3', name: 'Kabir T.', text: 'Finally a sunscreen with no white cast and no grease. Solar Veil is a daily staple now.', rating: 5, product: 'Solar Veil' }
    ],
    coupons: [
      {
        id: 'c1',
        code: 'WELCOME10',
        type: 'percent',
        value: 10,
        minOrder: 500,
        maxDiscount: 200,
        usageLimit: 100,
        usageCount: 0,
        validFrom: '2026-10-01',
        validUntil: '2026-12-31',
        active: true,
        description: '10% off on your first order (max ₹200 off)'
      },
      {
        id: 'c2',
        code: 'AUREONE10',
        type: 'percent',
        value: 10,
        minOrder: 500,
        maxDiscount: 250,
        usageLimit: 200,
        usageCount: 0,
        validFrom: '2026-10-01',
        validUntil: '2026-12-31',
        active: true,
        description: '10% privilege discount on all rituals (max ₹250 off)'
      },
      {
        id: 'c3',
        code: 'RITUAL150',
        type: 'flat',
        value: 150,
        minOrder: 1499,
        maxDiscount: 0,
        usageLimit: 50,
        usageCount: 0,
        validFrom: '2026-10-01',
        validUntil: '2026-12-31',
        active: true,
        description: 'Flat ₹150 off on orders above ₹1,499'
      },
      {
        id: 'c4',
        code: 'GLOW20',
        type: 'percent',
        value: 20,
        minOrder: 1999,
        maxDiscount: 500,
        usageLimit: 50,
        usageCount: 0,
        validFrom: '2026-10-01',
        validUntil: '2026-12-31',
        active: true,
        description: '20% off on orders above ₹1,999 (max ₹500 off)'
      },
      {
        id: 'c5',
        code: 'AUREONE20',
        type: 'percent',
        value: 20,
        minOrder: 1999,
        maxDiscount: 500,
        usageLimit: 50,
        usageCount: 0,
        validFrom: '2026-10-01',
        validUntil: '2026-12-31',
        active: true,
        description: '20% festive celebration on orders above ₹1,999'
      }
    ]
  };
};
