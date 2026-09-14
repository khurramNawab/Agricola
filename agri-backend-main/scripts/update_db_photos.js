const mongoose = require('mongoose');

async function updateDatabase() {
  await mongoose.connect('mongodb://localhost:27017/agricola');
  console.log('Connected to MongoDB');

  const db = mongoose.connection.db;

  // 1. Update Campaign
  const festivalImageUrl = "https://images.unsplash.com/photo-1605648916361-9bc12ad6a569?auto=format&fit=crop&w=1200&q=85";
  const campaignRes = await db.collection('herocampaigns').updateMany(
    { name: "Diwali Grand Sale" },
    {
      $set: {
        "slides.0.image": festivalImageUrl,
        "slides.0.title": "Festive Pure Essentials",
        "slides.0.description": "Celebrate Diwali & Durga Puja with pure, soil-tested organic sweets, foxnuts & cold-pressed goodness.",
        "videoModule.isEnabled": true,
        "videoModule.videoUrl": "https://www.youtube.com/shorts/cG8Ay4eOAoA",
        "videoModule.videoType": "youtube",
        "videoModule.title": "Experience The Craft of Pure Living",
        "videoModule.position": "hero_banner"
      }
    }
  );
  console.log('Campaigns updated:', campaignRes.modifiedCount);

  // 2. Update Products Photos
  const productPhotos = {
    P001: [
      "https://images.unsplash.com/photo-1599707367072-cd6ada2bc375?auto=format&fit=crop&w=800&q=85",
      "https://images.unsplash.com/photo-1547825407-2d060104b7f8?auto=format&fit=crop&w=800&q=85",
    ],
    P002: [
      "https://images.unsplash.com/photo-1514651178-f7c92df7d3d5?auto=format&fit=crop&w=800&q=85",
      "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=85",
    ],
    P003: [
      "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=800&q=85",
      "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=85",
    ],
    P004: [
      "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=800&q=85",
      "https://images.unsplash.com/photo-1471193945509-9ad0617afabf?auto=format&fit=crop&w=800&q=85",
    ],
    P005: [
      "https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=800&q=85",
      "https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?auto=format&fit=crop&w=800&q=85",
    ],
  };

  for (const [sku, images] of Object.entries(productPhotos)) {
    const r = await db.collection('products').updateOne(
      { sku },
      { $set: { images, image: images[0] } }
    );
    console.log('Product ' + sku + ' images updated: ' + r.modifiedCount);
  }

  // 3. Update Categories Images
  const categoryImages = {
    "snacks-nuts": "https://images.unsplash.com/photo-1599707367072-cd6ada2bc375?auto=format&fit=crop&w=600&q=80",
    "organic-spices": "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=600&q=80",
    "cold-pressed-oils": "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80",
  };

  for (const [slug, img] of Object.entries(categoryImages)) {
    await db.collection('categories').updateOne(
      { slug },
      { $set: { image: img } }
    );
  }
  console.log('Categories images updated');

  await mongoose.disconnect();
}

updateDatabase().catch(err => {
  console.error('Database update error:', err);
  process.exit(1);
});
