const mongoose = require('mongoose');

async function main() {
  await mongoose.connect('mongodb://localhost:27017/agricola');
  console.log('Connected to MongoDB');
  const db = mongoose.connection.db;

  const mapping = [
    {
      name: 'Premium Organic Makhana 200g',
      images: [
        'https://images.unsplash.com/photo-1599707367072-cd6ada2bc375?auto=format&fit=crop&w=800&q=85',
        'https://images.unsplash.com/photo-1547825407-2d060104b7f8?auto=format&fit=crop&w=800&q=85'
      ]
    },
    {
      name: 'Raw Organic Chia Seeds 250g',
      images: [
        'https://images.unsplash.com/photo-1514651178-f7c92df7d3d5?auto=format&fit=crop&w=800&q=85',
        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=85'
      ]
    },
    {
      name: 'Lakadong High-Curcumin Turmeric 100g',
      images: [
        'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=800&q=85',
        'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=85'
      ]
    },
    {
      name: 'Cold-Pressed Yellow Mustard Oil 1L',
      images: [
        'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=800&q=85',
        'https://images.unsplash.com/photo-1471193945509-9ad0617afabf?auto=format&fit=crop&w=800&q=85'
      ]
    },
    {
      name: 'Raw Forest Wildflower Honey 500g',
      images: [
        'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=800&q=85',
        'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?auto=format&fit=crop&w=800&q=85'
      ]
    }
  ];

  for (const item of mapping) {
    const res = await db.collection('products').updateOne(
      { name: item.name },
      { $set: { images: item.images, image: item.images[0] } }
    );
    console.log(item.name, 'updated:', res.modifiedCount);
  }

  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
