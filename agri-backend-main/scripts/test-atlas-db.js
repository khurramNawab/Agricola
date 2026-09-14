const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const mongoose = require('mongoose');

const uri = 'mongodb+srv://ephyraindia_db_user:RaH84TjKGADpUBqv@agricoladev.dfpfzvu.mongodb.net/agricola?appName=agricoladev';

async function testConnection() {
  console.log('Connecting to MongoDB Atlas at agricoladev with Google DNS...');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  console.log('✅ Connected to MongoDB Atlas successfully!');
  
  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log('\nCollections found:');

  for (const c of collections) {
    const count = await mongoose.connection.db.collection(c.name).countDocuments();
    console.log(` - ${c.name}: ${count} documents`);
  }

  // Check products specifically
  const products = await mongoose.connection.db.collection('products').find({}).toArray();
  console.log(`\nFound ${products.length} Products in Atlas DB:`);
  products.forEach((p, idx) => {
    console.log(` [${idx + 1}] ${p.name || p.title} (ID: ${p._id}) - Category: ${p.category} - Images: ${JSON.stringify(p.images || p.image)}`);
  });

  await mongoose.disconnect();
  console.log('\nConnection test completed.');
}

testConnection().catch((err) => {
  console.error('❌ MongoDB Atlas connection error:', err);
  process.exit(1);
});
