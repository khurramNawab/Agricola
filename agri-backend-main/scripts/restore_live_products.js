const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../src/models/Product');
const Category = require('../src/models/Category');

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB Atlas');

    // 1. Set P008 (Agricola Peda) as featured: true
    await Product.updateOne({ productId: 'P008' }, { $set: { featured: true } });
    console.log('✓ P008 set as featured: true');

    // 2. Ensure categories exist
    const catSeeds = await Category.findOneAndUpdate(
      { slug: 'seeds-nuts' },
      {
        $set: {
          name: 'Seeds & Nuts',
          slug: 'seeds-nuts',
          status: 'active',
          image: { url: 'https://images.unsplash.com/photo-1514651178-f7c92df7d3d5?auto=format&fit=crop&w=600&q=80' }
        }
      },
      { upsert: true, new: true }
    );

    const catSpices = await Category.findOneAndUpdate(
      { slug: 'organic-spices' },
      {
        $set: {
          name: 'Organic Spices',
          slug: 'organic-spices',
          status: 'active',
          image: { url: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=600&q=80' }
        }
      },
      { upsert: true, new: true }
    );

    const catOils = await Category.findOneAndUpdate(
      { slug: 'cold-pressed-oils' },
      {
        $set: {
          name: 'Cold-Pressed Oils',
          slug: 'cold-pressed-oils',
          status: 'active',
          image: { url: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80' }
        }
      },
      { upsert: true, new: true }
    );

    // 3. Restore previous developer's products P001 to P005
    const productsToSeed = [
      {
        productId: 'P001',
        name: 'Premium Organic Makhana 200g',
        price: 299,
        compareAtPrice: 350,
        category: '6a316eee75d2af86bc7b852c', // Makhana category
        stock: 120,
        sizes: ['200g', '500g'],
        tags: ['Makhana', 'Superfood', 'Healthy Snack'],
        status: 'active',
        featured: true,
        description: '100% certified organic roasted foxnuts sourced directly from Mithila farms.',
        about: 'Zero adulteration, vacuum processed for crisp freshness.',
        usageInstructions: 'Healthy snacking anytime, or lightly tossed in cow ghee.',
        whyChoose: 'GI Tagged, nutrient dense with zero trans fat.',
        images: [{ url: '/assets/makhana1.png', alt: 'Makhana' }]
      },
      {
        productId: 'P002',
        name: 'Raw Organic Chia Seeds 250g',
        price: 199,
        compareAtPrice: 249,
        category: catSeeds._id,
        stock: 95,
        sizes: ['250g', '500g'],
        tags: ['Seeds', 'Chia Seeds', 'Omega-3', 'Fiber'],
        status: 'active',
        featured: true,
        description: 'Pure black chia seeds packed with omega-3 fatty acids and dietary fiber.',
        about: 'Superfood seeds for digestive vitality and sustained energy.',
        usageInstructions: 'Soak 1 tbsp in water, smoothies, or yogurt for 15 mins before consuming.',
        whyChoose: 'Chemical-free, rich in plant protein and antioxidants.',
        images: [{ url: 'https://images.unsplash.com/photo-1514651178-f7c92df7d3d5?auto=format&fit=crop&w=800&q=85', alt: 'Chia Seeds' }]
      },
      {
        productId: 'P003',
        name: 'Lakadong High-Curcumin Turmeric 100g',
        price: 149,
        compareAtPrice: 180,
        category: catSpices._id,
        stock: 150,
        sizes: ['100g', '250g'],
        tags: ['Spices', 'Turmeric', 'Curcumin'],
        status: 'active',
        featured: true,
        description: 'High-potency 7.8% curcumin turmeric from the hills of Meghalaya.',
        about: 'Potent medicinal spice known for anti-inflammatory immunity support.',
        usageInstructions: 'Add 1/2 tsp to warm milk or daily culinary dishes.',
        whyChoose: 'Highest natural curcumin content without synthetic extraction.',
        images: [{ url: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=800&q=85', alt: 'Turmeric' }]
      },
      {
        productId: 'P004',
        name: 'Cold-Pressed Yellow Mustard Oil 1L',
        price: 329,
        compareAtPrice: 380,
        category: catOils._id,
        stock: 75,
        sizes: ['1L', '2L', '5L'],
        tags: ['Oils', 'Mustard Oil', 'Cold Pressed'],
        status: 'active',
        featured: true,
        description: 'Traditional Kachi Ghani wood-pressed yellow mustard oil.',
        about: 'Unrefined, pungent oil pressed at room temperature to preserve natural vitamins.',
        usageInstructions: 'Ideal for daily Indian cooking, stir fries, and traditional pickles.',
        whyChoose: 'Zero chemicals, zero argemone adulteration, authentic aroma.',
        images: [{ url: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=800&q=85', alt: 'Mustard Oil' }]
      },
      {
        productId: 'P005',
        name: 'Raw Forest Wildflower Honey 500g',
        price: 449,
        compareAtPrice: 499,
        category: catSeeds._id,
        stock: 60,
        sizes: ['500g', '1kg'],
        tags: ['Honey', 'Raw Honey', 'Natural'],
        status: 'active',
        featured: true,
        description: 'Unpasteurized, unprocessed multifloral raw forest honey.',
        about: 'Directly collected by tribal bee-keepers from deep forest reserves.',
        usageInstructions: '1 spoonful with lukewarm water or green tea.',
        whyChoose: 'Unheated, enzyme-rich, naturally crystalizing raw honey.',
        images: [{ url: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=800&q=85', alt: 'Raw Honey' }]
      }
    ];

    for (const p of productsToSeed) {
      await Product.findOneAndUpdate(
        { productId: p.productId },
        { $set: p },
        { upsert: true, new: true }
      );
      console.log(`✓ Seeded ${p.productId}: ${p.name}`);
    }

    const totalCount = await Product.countDocuments();
    console.log(`\n🎉 Done! Total products in MongoDB: ${totalCount}`);
    process.exit(0);
  } catch (error) {
    console.error('Error restoring products:', error);
    process.exit(1);
  }
}

run();
