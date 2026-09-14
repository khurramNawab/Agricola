const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Blog = require('../src/models/Blog');

const SEED_ARTICLES = [
  {
    title: "Why Mithila Foxnuts (Makhana) Carry a Coveted Geographical Indication (GI) Tag",
    slug: "why-mithila-foxnuts-carry-coveted-gi-tag",
    excerpt: "Explore how traditional wetland harvesting in Northern Bihar creates nutrient-dense superfood pops with unrivaled crunch and calcium purity.",
    content: `<h2>The Heritage of Wetland Agriculture</h2>
<p>Mithila Makhana (Euryale ferox) is not merely a snack; it is an ecological marvel cultivated in the perennial wetlands and oxbow lakes of Northern Bihar. Awarded the prestigious <strong>Geographical Indication (GI) tag</strong>, this superfood represents over a millennium of indigenous harvesting expertise.</p>

<div class="my-6 p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900">
  <h4 class="font-bold text-sm">🌿 What Makes Mithila Makhana GI-Certified?</h4>
  <p class="text-xs mt-1">The mineral-rich alluvial wetland silt, unpolluted surface aquifers, and specialized non-mechanical popping techniques ensure zero nutrient degradation and maximum organic bioavailability.</p>
</div>

<h3>Key Nutritional Superiority</h3>
<ul>
  <li><strong>Unrivaled Mineral Density:</strong> High natural concentrations of calcium, magnesium, and phosphorus for bone vitality.</li>
  <li><strong>Low Glycemic Index (GI):</strong> Safe and stabilizing for sustained metabolic release and blood sugar management.</li>
  <li><strong>Zero Trans Fats & Gluten-Free:</strong> Naturally anti-inflammatory with abundant kaempferol flavonoids.</li>
</ul>

<h3>From Pond Harvest to Wood Fire Roasting</h3>
<p>Harvested by traditional <em>Mallah</em> community divers who retrieve the thorny seed pods from lakebeds without chemical nets, the seeds are sun-cured, graded, and roasted over controlled wood embers before hand-popping.</p>

<blockquote>"When you crunch an authentic Mithila Makhana, you are tasting water, sunlight, and a thousand years of sustainable wetland conservation."</blockquote>`,
    coverImage: "https://images.unsplash.com/photo-1582793988951-9aed5509eb97?auto=format&fit=crop&w=1200&q=80",
    author: {
      name: "Devraj Roy",
      role: "Agricultural Provenance Specialist",
      avatar: ""
    },
    category: "Heritage & Craft",
    tags: ["Makhana", "GI Tag", "Mithila", "Superfood", "Healthy Snacks"],
    status: "published",
    readTime: "4 min read",
    viewCount: 142,
    featured: true,
    publishedAt: new Date(),
    seo: {
      metaTitle: "Mithila Foxnuts (Makhana) GI Tag & Health Benefits • AgriCola",
      metaDescription: "Discover why Mithila Makhana holds a coveted GI tag. Learn about traditional wetland harvesting and superior calcium-rich superfood benefits.",
      focusKeyword: "Mithila Makhana GI Tag",
      canonicalUrl: "https://agricola.in/blog/why-mithila-foxnuts-carry-coveted-gi-tag"
    }
  },
  {
    title: "The Science of Cold-Pressed Mustard Oil: Wood Ghani vs Modern Industrial Mills",
    slug: "science-of-cold-pressed-mustard-oil",
    excerpt: "Why temperature-controlled crushing below 40°C preserves critical pungent allylisothiocyanates and healthy monounsaturated fatty acids.",
    content: `<h2>The Heat Factor in Oil Extraction</h2>
<p>In modern industrial refineries, mustard seeds are subjected to temperatures surpassing <strong>160°C</strong> along with chemical solvent extractions like hexane. While this maximizes commercial output, it destroys volatile aromatic compounds and oxidizes heart-healthy omega fatty acids.</p>

<h3>The Traditional Wood Ghani Difference</h3>
<p>AgriCola's cold-pressed mustard oil is extracted in small artisanal batches using <em>Kachi Ghani</em> wooden pestles rotated at slow RPMs. The extraction temperature never crosses <strong>38°C</strong>.</p>

<div class="my-6 p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900">
  <h4 class="font-bold text-sm">💡 Preserving Allylisothiocyanate (AITC)</h4>
  <p class="text-xs mt-1">That distinct natural pungency in pure mustard oil comes from AITC — a potent compound scientifically documented to exhibit antimicrobial, cardiac, and respiratory therapeutic properties.</p>
</div>

<h3>Nutritional Comparison: Wood Ghani vs Refined Oils</h3>
<ul>
  <li><strong>Optimal Omega 3 to Omega 6 Ratio:</strong> Essential for cardiovascular rhythm and cellular membrane health.</li>
  <li><strong>Natural Vitamin E (Tocopherols):</strong> High natural antioxidant content that acts as an organic preservative without chemical BHT/BHA.</li>
  <li><strong>Zero Solvent Residue:</strong> 100% mechanical expulsion without synthetic chemical washing.</li>
</ul>

<blockquote>"True edible oil should taste like the crop it was born from — aromatic, sharp, and alive with enzymes."</blockquote>`,
    coverImage: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=1200&q=80",
    author: {
      name: "Dr. Ananya Sen",
      role: "Nutritional Biochemist",
      avatar: ""
    },
    category: "Organic Farming",
    tags: ["Mustard Oil", "Cold Pressed", "Wood Ghani", "Heart Health"],
    status: "published",
    readTime: "5 min read",
    viewCount: 238,
    featured: false,
    publishedAt: new Date(),
    seo: {
      metaTitle: "Cold-Pressed Mustard Oil Science & Health Benefits • AgriCola",
      metaDescription: "Learn why cold-pressed wood ghani mustard oil retains vital AITC and omega fatty acids compared to industrial refined cooking oils.",
      focusKeyword: "Cold-Pressed Mustard Oil",
      canonicalUrl: "https://agricola.in/blog/science-of-cold-pressed-mustard-oil"
    }
  },
  {
    title: "Understanding High Curcumin Turmeric: The Lakadong Harvest Story",
    slug: "understanding-high-curcumin-turmeric-lakadong",
    excerpt: "Grown in the pristine Jaintia Hills of Meghalaya, discover why 7.8% organic curcumin levels deliver superior anti-inflammatory potency.",
    content: `<h2>The Jewel of Meghalaya's Jaintia Hills</h2>
<p>Standard grocery store turmeric contains between <strong>1.5% to 2.5% curcumin</strong>. Lakadong turmeric, nurtured by tribal farmers in the micro-climate of Meghalaya, consistently tests between <strong>7.5% to 9.2% curcumin</strong> — making it the world's most concentrated natural source.</p>

<h3>Why Curcumin Percentage Matters</h3>
<p>Curcumin is the primary bioactive polyphenol responsible for turmeric's celebrated cellular antioxidant and anti-inflammatory properties. A higher curcumin level means you need far less quantity to achieve medicinal therapeutic efficacy.</p>

<div class="my-6 p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900">
  <h4 class="font-bold text-sm">🌱 Synergistic Bio-Absorption</h4>
  <p class="text-xs mt-1">To unlock maximum bioavailability, always consume high-curcumin turmeric with a pinch of freshly ground black pepper (piperine increases curcumin absorption by up to 2000%) and a healthy lipid like A2 Cow Ghee.</p>
</div>

<h3>Regenerative Tribal Cultivation</h3>
<ul>
  <li><strong>Soil Purity:</strong> Forest-grade loamy soil untouched by chemical fertilizers.</li>
  <li><strong>Rain-Fed Irrigation:</strong> Nourished purely by pristine monsoon precipitation.</li>
  <li><strong>Slow Shade Drying:</strong> Sliced and shade-dried to protect volatile aromatic oils.</li>
</ul>

<blockquote>"Golden spice harvested not just for flavor, but for generational healing and cellular longevity."</blockquote>`,
    coverImage: "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=1200&q=80",
    author: {
      name: "Agricola Botanical Lab",
      role: "Phytochemical Research",
      avatar: ""
    },
    category: "Health & Wellness",
    tags: ["Turmeric", "Lakadong", "Curcumin", "Ayurveda", "Immunity"],
    status: "published",
    readTime: "6 min read",
    viewCount: 189,
    featured: false,
    publishedAt: new Date(),
    seo: {
      metaTitle: "Lakadong High Curcumin Turmeric Benefits • AgriCola",
      metaDescription: "Discover Lakadong Turmeric with 7.8%+ Curcumin from Meghalaya. Learn how to maximize bio-absorption for anti-inflammatory wellness.",
      focusKeyword: "Lakadong Turmeric Curcumin",
      canonicalUrl: "https://agricola.in/blog/understanding-high-curcumin-turmeric-lakadong"
    }
  },
  {
    title: "Vedic A2 Bilona Cow Ghee: The Ancient Ayurvedic Method of Gut Restoration",
    slug: "vedic-a2-bilona-cow-ghee-gut-health",
    excerpt: "Why traditional wooden bi-directional churning of whole milk curd creates butyric-acid rich golden elixir superior to industrial cream butter.",
    content: `<h2>The Lost Science of Bilona Churning</h2>
<p>Commercial supermarket ghee is mass-manufactured by boiling industrial cream separated through high-speed centrifugation. In stark contrast, <strong>Vedic Bilona Ghee</strong> follows an ancient five-step ritual starting from A2 Desi cow whole milk cultured into live curd.</p>

<h3>The 5 Sacred Stages of Bilona Ghee</h3>
<ol>
  <li><strong>Grass-Fed Grazing:</strong> Free-roaming indigenous Bos Indicus cows consuming medicinal herbs and green fodder.</li>
  <li><strong>Earthen Pot Fermentation:</strong> Whole milk is boiled and slowly cultured into live probiotic dahi (curd).</li>
  <li><strong>Bi-directional Churning:</strong> Hand-churned using wooden beaters (<em>Bilona</em>) in clockwise and counter-clockwise motions to separate makkhan.</li>
  <li><strong>Slow Fire Clarification:</strong> Melted over low cow-dung and firewood embers in brass vessels until pure amber clarity is achieved.</li>
  <li><strong>Granular Texture:</strong> Cooling naturally produces dense, aromatic, sand-like golden grains.</li>
</ol>

<div class="my-6 p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900">
  <h4 class="font-bold text-sm">✨ High Short-Chain Butyric Acid</h4>
  <p class="text-xs mt-1">Bilona Ghee is rich in short-chain fatty acids like butyrate, which directly nourishes the epithelial lining of the intestinal colon and lowers systemic inflammation.</p>
</div>

<blockquote>"In Ayurveda, pure Ghee is revered as Rasayana — that which rejuvenates every cell and strengthens Ojas (vital energy)."</blockquote>`,
    coverImage: "https://images.unsplash.com/photo-1628088062854-d1870b4553da?auto=format&fit=crop&w=1200&q=80",
    author: {
      name: "Vaidya Shivraj Sharma",
      role: "Senior Ayurvedic Consultant",
      avatar: ""
    },
    category: "Vedic Agriculture",
    tags: ["A2 Ghee", "Bilona", "Ayurveda", "Gut Health", "Desi Cow"],
    status: "published",
    readTime: "5 min read",
    viewCount: 312,
    featured: false,
    publishedAt: new Date(),
    seo: {
      metaTitle: "A2 Vedic Bilona Cow Ghee Benefits & Gut Health • AgriCola",
      metaDescription: "Learn how authentic A2 Bilona Cow Ghee is made through curd churning and why its high butyric acid restores gut microbiome health.",
      focusKeyword: "A2 Bilona Cow Ghee",
      canonicalUrl: "https://agricola.in/blog/vedic-a2-bilona-cow-ghee-gut-health"
    }
  },
  {
    title: "Raw Forest Honey vs Supermarket Sugar Syrup: How to Identify 100% Pure Honey",
    slug: "raw-forest-honey-vs-supermarket-sugar-syrup",
    excerpt: "Learn how nuclear magnetic resonance (NMR) testing and cold filtration expose rice syrup adulteration and preserve active pollen enzymes.",
    content: `<h2>The Modern Adulteration Epidemic</h2>
<p>Recent investigations have revealed that over <strong>75% of commercially branded honeys</strong> fail sophisticated adulteration tests, diluted with C3/C4 corn syrups and inverted rice sugar syrup imported to beat basic laboratory checks.</p>

<h3>What Truly Defines 'Raw' Forest Honey?</h3>
<p>AgriCola's wild forest honey is gathered from indigenous <em>Apis Dorsata</em> (giant rock bee) colonies nestled deep inside unpolluted deciduous reserves. It is never heated above 42°C and never micro-filtered.</p>

<div class="my-6 p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900">
  <h4 class="font-bold text-sm">🔬 Active Diastase & Invertase Enzymes</h4>
  <p class="text-xs mt-1">Raw honey contains natural digestive enzymes, live bee pollen grains, and royal jelly traces that provide antibacterial inhibine activity — all destroyed by commercial ultra-pasteurization.</p>
</div>

<h3>Simple Home Purity Checks</h3>
<ul>
  <li><strong>Water Dispersion Test:</strong> Pure raw honey settles at the bottom of a glass in thick strands without immediately dissolving into the water.</li>
  <li><strong>Natural Crystallization:</strong> Real, unheated raw honey naturally granulates in cooler weather due to its natural glucose-to-fructose ratio.</li>
  <li><strong>Aroma Profile:</strong> Authentic forest honey carries deep floral and woody nectar notes, never a plain synthetic sugar smell.</li>
</ul>

<blockquote>"Honey is nature's living nectar. If it has been stripped of its live pollen and cooked into clear syrup, it ceases to be medicine."</blockquote>`,
    coverImage: "https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=1200&q=80",
    author: {
      name: "Pooja Hegde",
      role: "Ecological Foraging Lead",
      avatar: ""
    },
    category: "Product Guides",
    tags: ["Raw Honey", "Forest Honey", "Purity Test", "Immunity", "Enzymes"],
    status: "published",
    readTime: "4 min read",
    viewCount: 267,
    featured: false,
    publishedAt: new Date(),
    seo: {
      metaTitle: "Raw Forest Honey Purity & Adulteration Guide • AgriCola",
      metaDescription: "Learn how to identify 100% pure raw wild forest honey. Discover the difference between cold-extracted enzyme-rich nectar and pasteurized syrup.",
      focusKeyword: "Raw Forest Honey Purity",
      canonicalUrl: "https://agricola.in/blog/raw-forest-honey-vs-supermarket-sugar-syrup"
    }
  },
  {
    title: "The Silent Adulteration in Everyday Spices: Why Stone Grinding Preserves Essential Oils",
    slug: "silent-adulteration-spices-stone-grinding",
    excerpt: "Why high-velocity pulverizers strip volatile terpenes and how cold stone-milling delivers unmatched antioxidant intensity and aromatic depth.",
    content: `<h2>The Heat Death of Kitchen Spices</h2>
<p>Commercial spice processing relies on high-speed steel pulverizers rotating at over 3,000 RPM. The tremendous kinetic friction elevates temperatures beyond <strong>90°C</strong>, vaporizing delicate essential oils like eugenol, piperine, and cineole before the spice even reaches your pantry.</p>

<h3>The Slow Stone-Chakkhi Method</h3>
<p>At AgriCola, spices are ground on traditional natural granite millstones operating at low velocities. The cool grinding process ensures that volatile aromatic terpenes remain trapped inside the micro-granules.</p>

<div class="my-6 p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900">
  <h4 class="font-bold text-sm">🌿 Zero Spent Spice Starch Extenders</h4>
  <p class="text-xs mt-1">Industrial powders frequently dilute spices with 'spent spice residue' (the leftover fiber after extracting essential oils for industrial perfumes). AgriCola guarantees 100% whole-seed single origin grind.</p>
</div>

<h3>Why Color & Aroma Are Indicators of Vitality</h3>
<ul>
  <li><strong>Vibrant Natural Pigments:</strong> Intact carotenoids and polyphenols indicate active cellular scavenging capability.</li>
  <li><strong>Longer Shelf Potency:</strong> Naturally preserved essential oils protect the ground spice from rapid oxidation.</li>
  <li><strong>Authentic Flavor Punch:</strong> You need half the conventional quantity for richer depth and aroma in your cooking.</li>
</ul>

<blockquote>"When you grind slow, you honor the plant. When you cook with pure spices, your food becomes preventive healthcare."</blockquote>`,
    coverImage: "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=1200&q=80",
    author: {
      name: "Chef Harish Nair",
      role: "Culinary Heritage Specialist",
      avatar: ""
    },
    category: "Sustainable Living",
    tags: ["Spices", "Stone Ground", "Purity", "Clean Eating", "Essential Oils"],
    status: "published",
    readTime: "5 min read",
    viewCount: 198,
    featured: false,
    publishedAt: new Date(),
    seo: {
      metaTitle: "Stone-Ground Spices vs Industrial Pulverizing • AgriCola",
      metaDescription: "Understand why low-temperature stone grinding retains essential oils and antioxidants in turmeric, coriander, and chili powders.",
      focusKeyword: "Stone Ground Organic Spices",
      canonicalUrl: "https://agricola.in/blog/silent-adulteration-spices-stone-grinding"
    }
  }
];

async function seed() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/agricola';
  console.log('Connecting to MongoDB at:', mongoUri);
  await mongoose.connect(mongoUri);
  console.log('Connected.');

  for (const item of SEED_ARTICLES) {
    const existing = await Blog.findOne({ slug: item.slug });
    if (!existing) {
      await Blog.create(item);
      console.log(`[Created] ${item.title}`);
    } else {
      await Blog.updateOne({ slug: item.slug }, { $set: item });
      console.log(`[Updated] ${item.slug}`);
    }
  }

  const count = await Blog.countDocuments();
  console.log(`Total blogs in database: ${count}`);
  await mongoose.disconnect();
  console.log('Seeding finished successfully.');
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
