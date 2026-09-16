const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
require('dotenv').config();
const Product = require('../src/models/Product');
const Category = require('../src/models/Category');

async function update() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    // 1. Activate tea products
    const teaIds = [
      '6aa52b24a4f7a264f1df81cc',
      '6aa52b24a4f7a264f1df81d7',
      '6aa52b25a4f7a264f1df81dd'
    ];
    const teaUpdate = await Product.updateMany(
      { _id: { $in: teaIds } },
      { $set: { status: 'active', stock: 50 } }
    );
    console.log('Tea products updated:', teaUpdate.modifiedCount);

    // 2. Deactivate requested categories
    const catSlugs = ['seeds-nuts', 'organic-spices', 'cold-pressed-oils'];
    const catUpdate = await Category.updateMany(
      { slug: { $in: catSlugs } },
      { $set: { status: 'inactive' } }
    );
    console.log('Categories set to inactive:', catUpdate.modifiedCount);

    // 3. Verify
    const activeProducts = await Product.find({ status: 'active' }).select('name status stock');
    console.log('Active Products count:', activeProducts.length);
    activeProducts.forEach(p => console.log(' -', p.name, '| stock:', p.stock));

    const activeCategories = await Category.find({ status: 'active' }).select('name slug');
    console.log('Active Categories count:', activeCategories.length);
    activeCategories.forEach(c => console.log(' -', c.name, '(', c.slug, ')'));

    process.exit(0);
  } catch (err) {
    console.error('Error updating catalog:', err);
    process.exit(1);
  }
}
update();
