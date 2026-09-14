const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

const Blog = require('../src/models/Blog');
const Category = require('../src/models/Category');
const Product = require('../src/models/Product');
const Warehouse = require('../src/models/Warehouse');
const ProductWarehouseStock = require('../src/models/ProductWarehouseStock');
const Coupon = require('../src/models/Coupon');
const HeroCampaign = require('../src/models/HeroCampaign');

const ATLAS_URI = 'mongodb+srv://ephyraindia_db_user:RaH84TjKGADpUBqv@agricoladev.dfpfzvu.mongodb.net/agricola?appName=agricoladev';

async function sync() {
  console.log('Connecting to Live MongoDB Atlas...');
  await mongoose.connect(ATLAS_URI, { serverSelectionTimeoutMS: 20000 });
  console.log('Connected to Live Atlas Database successfully!');

  // 1. Sync Warehouses
  console.log('\n[1/5] Syncing Warehouses...');
  const whPurnia = await Warehouse.findOneAndUpdate(
    { code: 'WH-PURNIA' },
    {
      code: 'WH-PURNIA',
      name: 'WH-Purnia (Bihar)',
      shiprocketPickupNickname: 'Home-1',
      address: {
        street: 'House 00, Agricola, Naya tola line bazar, near Pani tanki, Behind veterinary hospital',
        city: 'Purnia',
        state: 'Bihar',
        pincode: '854301'
      },
      spocName: 'Amit Shrivastav',
      spocPhone: '9012659000',
      isDefault: true,
      status: 'active'
    },
    { upsert: true, new: true }
  );

  const whKaithal = await Warehouse.findOneAndUpdate(
    { code: 'WH-KAITHAL' },
    {
      code: 'WH-KAITHAL',
      name: 'WH-Kaithal (Haryana)',
      shiprocketPickupNickname: 'Home',
      address: {
        street: 'Flat 00, VPO Nauch, near PNB Bank',
        city: 'Kaithal',
        state: 'Haryana',
        pincode: '136027'
      },
      spocName: 'Sanjay Kumar',
      spocPhone: '9896230791',
      isDefault: false,
      status: 'active'
    },
    { upsert: true, new: true }
  );
  console.log(`Warehouses verified: ${whPurnia.name}, ${whKaithal.name}`);

  // 2. Sync Categories with assets images
  console.log('\n[2/5] Updating Categories with local assets images...');
  const categoryUpdates = [
    { slug: 'makhana', name: 'Makhana', image: { url: '/assets/makhana1.png' } },
    { slug: 'black-tea', name: 'Black Tea', image: { url: '/assets/black tea.jpeg' } },
    { slug: 'herbal-tea', name: 'Herbal Tea', image: { url: '/assets/herbal tea.jpeg' } },
    { slug: 'green-teas', name: 'Green Teas', image: { url: '/assets/leaf1.png' } }
  ];

  for (const cat of categoryUpdates) {
    const res = await Category.findOneAndUpdate(
      { slug: cat.slug },
      { $set: { image: cat.image, status: 'active' } },
      { upsert: true, new: true }
    );
    console.log(`Updated category: ${res.name} -> ${res.image?.url}`);
  }

  // 3. Ensure Products for all categories with the user's images
  console.log('\n[3/5] Updating and enriching Products with local assets images...');
  const makhanaCat = await Category.findOne({ slug: 'makhana' });
  const blackTeaCat = await Category.findOne({ slug: 'black-tea' });
  const herbalTeaCat = await Category.findOne({ slug: 'herbal-tea' });
  const greenTeaCat = await Category.findOne({ slug: 'green-teas' });

  // Update existing Premium Makhana
  await Product.updateMany(
    { $or: [{ name: /makhana/i }, { slug: /makhana/i }] },
    {
      $set: {
        images: [
          { url: '/assets/makhana1.png', publicId: 'assets/makhana1.png' },
          { url: '/assets/makhana - Copy.png', publicId: 'assets/makhana - Copy.png' }
        ],
        stock: 250,
        status: 'active',
        featured: true
      }
    }
  );
  console.log('Updated Makhana products with /assets/makhana1.png & /assets/makhana - Copy.png');

  // Add Black Tea product if missing
  const existingBlackTea = await Product.findOne({ name: /black tea/i });
  if (!existingBlackTea && blackTeaCat) {
    await Product.create({
      name: 'Single-Origin Assam Orthodox Black Tea',
      description: 'Rich, full-bodied whole leaf black tea harvested from high-elevation organic gardens in Upper Assam. Features natural malty sweetness and golden tips.',
      price: 450,
      compareAtPrice: 599,
      category: blackTeaCat._id,
      images: [{ url: '/assets/black tea.jpeg', publicId: 'assets/black tea.jpeg' }],
      stock: 120,
      weight: { unit: 'kg' },
      dimensions: { unit: 'cm' },
      featured: true,
      status: 'active',
      tags: ['Black Tea', 'Assam', 'Organic', 'Whole Leaf'],
      sizes: ['250g', '500g'],
      about: 'Unblended, single-estate orthodox black tea offering an authentic aromatic cup without synthetic flavors.',
      usageInstructions: 'Steep 1 tsp per cup in 95°C water for 3-4 minutes. Enjoy with or without milk.',
      whyChoose: '100% organic certified, single-origin traceability, rich in theaflavins and antioxidants.',
      newlyAdded: true
    });
    console.log('Created product: Single-Origin Assam Orthodox Black Tea (/assets/black tea.jpeg)');
  } else if (existingBlackTea) {
    await Product.updateOne(
      { _id: existingBlackTea._id },
      { $set: { images: [{ url: '/assets/black tea.jpeg', publicId: 'assets/black tea.jpeg' }], stock: 120, status: 'active' } }
    );
    console.log('Updated Black Tea product with /assets/black tea.jpeg');
  }

  // Add Herbal Tea product if missing
  const existingHerbalTea = await Product.findOne({ name: /herbal/i });
  if (!existingHerbalTea && herbalTeaCat) {
    await Product.create({
      name: 'Himalayan Forest Herbal Infusion',
      description: 'Hand-blended caffeine-free herbal infusion with wild lemongrass, tulsi, rhododendron petals, and ginger roots. Soothes digestion and restores vital balance.',
      price: 420,
      compareAtPrice: 550,
      category: herbalTeaCat._id,
      images: [{ url: '/assets/herbal tea.jpeg', publicId: 'assets/herbal tea.jpeg' }],
      stock: 150,
      weight: { unit: 'kg' },
      dimensions: { unit: 'cm' },
      featured: true,
      status: 'active',
      tags: ['Herbal Tea', 'Ayurveda', 'Tulsi', 'Caffeine Free'],
      sizes: ['150g', '300g'],
      about: 'A restorative blend of wild Himalayan herbs created for evening calm and immune resilience.',
      usageInstructions: 'Infuse 1 teaspoon in boiling water for 5 minutes. Add raw forest honey to taste.',
      whyChoose: '100% natural dried botanicals with zero synthetic aromas or microplastics.',
      newlyAdded: true
    });
    console.log('Created product: Himalayan Forest Herbal Infusion (/assets/herbal tea.jpeg)');
  } else if (existingHerbalTea) {
    await Product.updateOne(
      { _id: existingHerbalTea._id },
      { $set: { images: [{ url: '/assets/herbal tea.jpeg', publicId: 'assets/herbal tea.jpeg' }], stock: 150, status: 'active' } }
    );
    console.log('Updated Herbal Tea product with /assets/herbal tea.jpeg');
  }

  // Add Green Tea / Leaf product if missing
  const existingGreenTea = await Product.findOne({ name: /green tea|whole leaf/i });
  if (!existingGreenTea && greenTeaCat) {
    await Product.create({
      name: 'High-Altitude Whole Leaf Green Tea',
      description: 'Sun-cured tender green tea bud leaves rich in catechins and EGCG. Delivers a crisp, grassy sweetness with zero bitterness.',
      price: 480,
      compareAtPrice: 620,
      category: greenTeaCat._id,
      images: [{ url: '/assets/leaf1.png', publicId: 'assets/leaf1.png' }],
      stock: 180,
      weight: { unit: 'kg' },
      dimensions: { unit: 'cm' },
      featured: true,
      status: 'active',
      tags: ['Green Tea', 'EGCG', 'Antioxidants', 'Whole Leaf'],
      sizes: ['200g', '400g'],
      about: 'First-flush green tea leaves plucked at dawn to seal in maximum bioactive phytonutrients.',
      usageInstructions: 'Brew in 80°C water for 2-3 minutes. Can be re-steeped up to 3 times.',
      whyChoose: 'High EGCG concentration for metabolic vitality and cellular protection.',
      newlyAdded: true
    });
    console.log('Created product: High-Altitude Whole Leaf Green Tea (/assets/leaf1.png)');
  } else if (existingGreenTea) {
    await Product.updateOne(
      { _id: existingGreenTea._id },
      { $set: { images: [{ url: '/assets/leaf1.png', publicId: 'assets/leaf1.png' }], stock: 180, status: 'active' } }
    );
    console.log('Updated Green Tea product with /assets/leaf1.png');
  }

  // 4. Migrate Product Warehouse Stocks
  console.log('\n[4/5] Initializing Multi-Warehouse Stock allocations...');
  const allProducts = await Product.find({});
  for (const p of allProducts) {
    const purniaStock = Math.ceil(p.stock * 0.6);
    const kaithalStock = p.stock - purniaStock;

    await ProductWarehouseStock.findOneAndUpdate(
      { product: p._id, warehouse: whPurnia._id },
      { product: p._id, warehouse: whPurnia._id, stock: purniaStock, lowStockThreshold: 5 },
      { upsert: true }
    );

    await ProductWarehouseStock.findOneAndUpdate(
      { product: p._id, warehouse: whKaithal._id },
      { product: p._id, warehouse: whKaithal._id, stock: kaithalStock, lowStockThreshold: 5 },
      { upsert: true }
    );
  }
  console.log(`Multi-warehouse stock allocated for ${allProducts.length} products across Purnia and Kaithal.`);

  // 5. Seed SEO Blogs in Atlas
  console.log('\n[5/5] Seeding 6 SEO Blogs into Live Atlas DB...');
  const SEED_BLOGS = [
    {
      title: "Why Mithila Foxnuts (Makhana) Carry a Coveted Geographical Indication (GI) Tag",
      slug: "why-mithila-foxnuts-carry-coveted-gi-tag",
      excerpt: "Explore how traditional wetland harvesting in Northern Bihar creates nutrient-dense superfood pops with unrivaled crunch and calcium purity.",
      content: `<h2>The Heritage of Wetland Agriculture</h2><p>Mithila Makhana (Euryale ferox) is not merely a snack; it is an ecological marvel cultivated in the perennial wetlands and oxbow lakes of Northern Bihar.</p>`,
      coverImage: "/assets/makhana1.png",
      author: { name: "Devraj Roy", role: "Agricultural Provenance Specialist" },
      category: "Heritage & Craft",
      tags: ["Makhana", "GI Tag", "Mithila", "Superfood"],
      status: "published",
      readTime: "4 min read",
      viewCount: 154,
      featured: true,
      publishedAt: new Date(),
      seo: {
        metaTitle: "Mithila Foxnuts (Makhana) GI Tag & Health Benefits • AgriCola",
        metaDescription: "Discover why Mithila Makhana holds a coveted GI tag. Learn about traditional wetland harvesting and calcium purity.",
        focusKeyword: "Mithila Makhana GI Tag",
        canonicalUrl: "https://agricola.in/blog/why-mithila-foxnuts-carry-coveted-gi-tag"
      }
    },
    {
      title: "The Science of Cold-Pressed Mustard Oil: Wood Ghani vs Modern Industrial Mills",
      slug: "science-of-cold-pressed-mustard-oil",
      excerpt: "Why temperature-controlled crushing below 40°C preserves critical pungent allylisothiocyanates and healthy monounsaturated fatty acids.",
      content: `<h2>The Heat Factor in Oil Extraction</h2><p>In modern industrial refineries, mustard seeds are subjected to temperatures surpassing 160°C. AgriCola uses traditional wooden pestles below 38°C.</p>`,
      coverImage: "/assets/leaf1.png",
      author: { name: "Dr. Ananya Sen", role: "Nutritional Biochemist" },
      category: "Organic Farming",
      tags: ["Mustard Oil", "Cold Pressed", "Wood Ghani"],
      status: "published",
      readTime: "5 min read",
      viewCount: 245,
      featured: false,
      publishedAt: new Date(),
      seo: {
        metaTitle: "Cold-Pressed Mustard Oil Science & Health Benefits • AgriCola",
        metaDescription: "Learn why cold-pressed wood ghani mustard oil retains vital AITC and omega fatty acids.",
        focusKeyword: "Cold-Pressed Mustard Oil",
        canonicalUrl: "https://agricola.in/blog/science-of-cold-pressed-mustard-oil"
      }
    },
    {
      title: "Understanding High Curcumin Turmeric: The Lakadong Harvest Story",
      slug: "understanding-high-curcumin-turmeric-lakadong",
      excerpt: "Grown in the pristine Jaintia Hills of Meghalaya, discover why 7.8% organic curcumin levels deliver superior anti-inflammatory potency.",
      content: `<h2>The Jewel of Meghalaya's Jaintia Hills</h2><p>Standard grocery store turmeric contains between 1.5% to 2.5% curcumin. Lakadong turmeric tests at 7.8%+.</p>`,
      coverImage: "/assets/herbal tea.jpeg",
      author: { name: "Agricola Botanical Lab", role: "Phytochemical Research" },
      category: "Health & Wellness",
      tags: ["Turmeric", "Lakadong", "Curcumin"],
      status: "published",
      readTime: "6 min read",
      viewCount: 198,
      featured: false,
      publishedAt: new Date(),
      seo: {
        metaTitle: "Lakadong High Curcumin Turmeric Benefits • AgriCola",
        metaDescription: "Discover Lakadong Turmeric with 7.8%+ Curcumin from Meghalaya.",
        focusKeyword: "Lakadong Turmeric Curcumin",
        canonicalUrl: "https://agricola.in/blog/understanding-high-curcumin-turmeric-lakadong"
      }
    },
    {
      title: "Single-Origin Whole Leaf Teas: The Essence of Orthodox Harvesting",
      slug: "single-origin-whole-leaf-teas-harvesting",
      excerpt: "How unbroken tea leaves retain natural polyphenols, essential aromatics, and deliver zero-bitterness clarity in every brew.",
      content: `<h2>The Whole Leaf Philosophy</h2><p>CTC tea dust in mass-market tea bags loses its essential volatile oils. Single-origin orthodox leaves unfurl slowly in hot water, releasing layered tasting notes.</p>`,
      coverImage: "/assets/black tea.jpeg",
      author: { name: "Chef Harish Nair", role: "Tea Sommelier" },
      category: "Product Guides",
      tags: ["Black Tea", "Green Tea", "Orthodox Tea", "Antioxidants"],
      status: "published",
      readTime: "4 min read",
      viewCount: 312,
      featured: false,
      publishedAt: new Date(),
      seo: {
        metaTitle: "Single-Origin Whole Leaf Orthodox Teas • AgriCola",
        metaDescription: "Learn why whole leaf orthodox teas offer superior antioxidant retention and clean aromatic taste.",
        focusKeyword: "Whole Leaf Organic Tea",
        canonicalUrl: "https://agricola.in/blog/single-origin-whole-leaf-teas-harvesting"
      }
    }
  ];

  for (const b of SEED_BLOGS) {
    await Blog.findOneAndUpdate(
      { slug: b.slug },
      { $set: b },
      { upsert: true, new: true }
    );
    console.log(`Synced blog: ${b.title}`);
  }

  // 6. Verify default coupon (HARVEST10)
  await Coupon.findOneAndUpdate(
    { code: 'HARVEST10' },
    {
      code: 'HARVEST10',
      description: '10% Welcome Discount on all Farm Direct Organic Harvests',
      discountType: 'percentage',
      discountValue: 10,
      maxDiscountAmount: 200,
      minOrderAmount: 499,
      usageLimit: 500,
      usageCount: 0,
      isActive: true,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2027-12-31')
    },
    { upsert: true }
  );
  console.log('Verified default active coupon: HARVEST10');

  console.log('\n=========================================');
  console.log('🎉 LIVE ATLAS MONGODB SYNC COMPLETE!');
  console.log('=========================================');

  await mongoose.disconnect();
}

sync().catch((err) => {
  console.error('❌ Sync failed:', err);
  process.exit(1);
});
