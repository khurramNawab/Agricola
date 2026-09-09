const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models
const User = require('../src/models/User');
const Category = require('../src/models/Category');
const Product = require('../src/models/Product');

const seedData = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Category.deleteMany({});
    await Product.deleteMany({});
    console.log('Cleared existing data');

    // Create admin user
    const adminPassword = await bcrypt.hash('admin123', 12);
    const admin = await User.create({
      name: 'Admin User',
      email: 'admin@agricola.com',
      password: 'admin123', // Will be hashed by pre-save middleware
      phone: '+919999999999',
      role: 'admin',
      status: 'active'
    });
    console.log('Created admin user');

    // Create sample customer users
    const customers = [
      {
        name: 'Priya Sharma',
        email: 'priyash12@gmail.com',
        password: 'password123',
        phone: '+919876543210'
      },
      {
        name: 'Kiran Gupta',
        email: 'kiran.g@gmail.com',
        password: 'password123',
        phone: '+919123456780'
      },
      {
        name: 'Suresh Reddy',
        email: 'sureshr@gmail.com',
        password: 'password123',
        phone: '+919988776655'
      },
      {
        name: 'Anjali Mehta',
        email: 'anjalimehta@yahoo.com',
        password: 'password123',
        phone: '+919988112233'
      },
      {
        name: 'Rahul Singh',
        email: 'rahulsingh@hotmail.com',
        password: 'password123',
        phone: '+919876123456'
      }
    ];

    // Create sequentially (not insertMany): the User pre('validate') hook derives
    // userId from countDocuments(), so a bulk insert makes every doc read the same
    // count and generate a duplicate userId. Sequential create() lets the count
    // advance per document.
    const createdCustomers = [];
    for (const c of customers) {
      createdCustomers.push(await User.create(c));
    }
    console.log(`Created ${createdCustomers.length} customer users`);

    // Create categories
    const categories = [
      {
        name: 'Grains & Pulses',
        description: 'Wholesome grains, rice, lentils and pulses sourced from trusted farms',
        status: 'active',
        sortOrder: 1
      },
      {
        name: 'Vegetables',
        description: 'Farm-fresh vegetables harvested at peak ripeness',
        status: 'active',
        sortOrder: 2
      },
      {
        name: 'Fruits',
        description: 'Seasonal and exotic fruits picked fresh',
        status: 'active',
        sortOrder: 3
      },
      {
        name: 'Spices',
        description: 'Fresh and aromatic spices',
        status: 'active',
        sortOrder: 4
      },
      {
        name: 'Dairy',
        description: 'Pure dairy products from local farms',
        status: 'active',
        sortOrder: 5
      },
      {
        name: 'Seeds & Gardening',
        description: 'Quality seeds and essentials for your home garden',
        status: 'active',
        sortOrder: 6
      }
    ];

    // Sequential create() so the Category pre('save') hook runs and generates the
    // unique `slug` for each doc (insertMany skips save hooks, leaving slug unset →
    // duplicate-null collisions on the unique slug index).
    const createdCategories = [];
    for (const c of categories) {
      createdCategories.push(await Category.create(c));
    }
    console.log(`Created ${createdCategories.length} categories`);

    // Create sample products
    const products = [
      {
        name: 'Organic Basmati Rice',
        description: 'Premium long-grain basmati rice grown on organic farms. Aromatic, fluffy, and perfect for everyday meals.',
        price: 299.99,
        category: createdCategories[0]._id, // Grains & Pulses
        images: [
          {
            url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80',
            alt: 'Organic Basmati Rice'
          }
        ],
        stock: 100,
        featured: true,
        tags: ['organic', 'grains', 'staple'],
        rating: { average: 4.5, count: 45 },
        status: 'active'
      },
      {
        name: 'Toor Dal (Split Pigeon Peas)',
        description: 'Wholesome unpolished toor dal, a protein-rich pulse and a kitchen essential for everyday Indian cooking.',
        price: 159.99,
        category: createdCategories[0]._id, // Grains & Pulses
        images: [
          {
            url: 'https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=800&q=80',
            alt: 'Toor Dal'
          }
        ],
        stock: 90,
        featured: true,
        tags: ['protein', 'pulses', 'unpolished'],
        rating: { average: 4.3, count: 32 },
        status: 'active'
      },
      {
        name: 'Fresh Tomatoes',
        description: 'Farm-fresh, vine-ripened tomatoes harvested daily. Juicy and full of flavour for curries and salads.',
        price: 49.99,
        category: createdCategories[1]._id, // Vegetables
        images: [
          {
            url: 'https://images.unsplash.com/photo-1546470427-e26264be0b0d?auto=format&fit=crop&w=800&q=80',
            alt: 'Fresh Tomatoes'
          }
        ],
        stock: 50,
        featured: false,
        tags: ['fresh', 'vegetable', 'seasonal'],
        rating: { average: 4.7, count: 28 },
        status: 'active'
      },
      {
        name: 'Alphonso Mangoes',
        description: 'The king of mangoes — sweet, fragrant Alphonso mangoes picked at peak ripeness from Ratnagiri orchards.',
        price: 599.99,
        category: createdCategories[2]._id, // Fruits
        images: [
          {
            url: 'https://images.unsplash.com/photo-1605027990121-cbae9e0642df?auto=format&fit=crop&w=800&q=80',
            alt: 'Alphonso Mangoes'
          }
        ],
        stock: 80,
        featured: true,
        tags: ['seasonal', 'fruit', 'premium'],
        rating: { average: 4.4, count: 38 },
        status: 'active'
      },
      {
        name: 'Farm Fresh Paneer',
        description: 'Soft, fresh paneer made from pure full-cream milk. A protein-packed staple for everyday meals.',
        price: 89.99,
        category: createdCategories[4]._id, // Dairy
        images: [
          {
            url: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=800&q=80',
            alt: 'Farm Fresh Paneer'
          }
        ],
        stock: 60,
        featured: false,
        tags: ['dairy', 'protein', 'fresh'],
        rating: { average: 4.6, count: 22 },
        status: 'active'
      },
      {
        name: 'Organic Turmeric',
        description: 'Pure organic turmeric powder with curcumin. Perfect for cooking and health benefits.',
        price: 199.99,
        category: createdCategories[3]._id, // Spices
        images: [
          {
            url: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=800&q=80',
            alt: 'Organic Turmeric'
          }
        ],
        stock: 120,
        featured: false,
        tags: ['organic', 'spice', 'healthy'],
        rating: { average: 4.8, count: 55 },
        status: 'active'
      }
    ];

    // Sequential create() for the same reason as customers: Product's pre('validate')
    // hook derives productId from countDocuments(), so insertMany would generate
    // duplicate productIds.
    const createdProducts = [];
    for (const p of products) {
      createdProducts.push(await Product.create(p));
    }
    console.log(`Created ${createdProducts.length} products`);

    console.log('\n✅ Database seeded successfully!');
    console.log('\n🔐 Admin Login Credentials:');
    console.log('Email: admin@agricola.com');
    console.log('Password: admin123');
    console.log('\n👤 Sample Customer Login:');
    console.log('Email: priyash12@gmail.com');
    console.log('Password: password123');

  } catch (error) {
    console.error('Seeding failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDatabase connection closed');
    process.exit(0);
  }
};

// Run the seeding
if (require.main === module) {
  seedData();
}

module.exports = seedData;