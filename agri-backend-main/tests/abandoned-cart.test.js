const mongoose = require('mongoose');
const Cart = require('../src/models/Cart');
const User = require('../src/models/User');
const Order = require('../src/models/Order');
const Product = require('../src/models/Product');
const AbandonedCartLog = require('../src/models/AbandonedCartLog');
const { formatTemplate, buildWhatsAppLink, buildAbandonedCartEmail } = require('../src/utils/abandonedCart');

describe('Abandoned Cart System: Detection, Personalization & Logs', () => {
  let user1;
  let user2;
  let prod1;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/agricola_test');
    }

    user1 = await User.create({
      name: 'Aditi Roy',
      phone: '+919811122233',
      email: 'aditi@example.com',
      role: 'customer'
    });

    user2 = await User.create({
      name: 'Rahul Sen',
      phone: '+919844455566',
      email: 'rahul@example.com',
      role: 'customer'
    });

    prod1 = await Product.create({
      name: 'Organic Desi Ghee',
      description: 'Pure farm-fresh A2 organic desi cow ghee',
      category: new mongoose.Types.ObjectId(),
      price: 650,
      stock: 50,
      status: 'active',
      sku: 'GHEE-001',
      productId: 'P-GHEE1'
    });
  });

  afterAll(async () => {
    if (user1) await User.deleteOne({ _id: user1._id });
    if (user2) await User.deleteOne({ _id: user2._id });
    if (prod1) await Product.deleteOne({ _id: prod1._id });
    await Cart.deleteMany({ user: { $in: [user1?._id, user2?._id] } });
    await AbandonedCartLog.deleteMany({ user: { $in: [user1?._id, user2?._id] } });
    await Order.deleteMany({ user: { $in: [user1?._id, user2?._id] } });
  });

  test('formats personalized placeholders into message template', () => {
    const raw = 'Hi {name}, your {product} worth ₹{cart_total} is waiting! Use {coupon} at {checkout_url}';
    const personalized = formatTemplate(raw, {
      name: 'Aditi',
      product: 'Organic Desi Ghee (500g)',
      cartTotal: 1300,
      coupon: 'SAVE10',
      checkoutUrl: 'https://www.agricola.co.in/cart'
    });

    expect(personalized).toBe(
      'Hi Aditi, your Organic Desi Ghee (500g) worth ₹1300 is waiting! Use SAVE10 at https://www.agricola.co.in/cart'
    );
  });

  test('generates valid WhatsApp 1-click chat link with encoded parameters', () => {
    const link = buildWhatsAppLink('+919811122233', 'Hello Aditi, finish your cart!');
    expect(link).toContain('https://wa.me/919811122233?text=');
    expect(link).toContain(encodeURIComponent('Hello Aditi, finish your cart!'));
  });

  test('builds rich HTML email structure for abandoned cart', () => {
    const emailData = buildAbandonedCartEmail({
      name: 'Aditi',
      items: [{ name: 'Organic Desi Ghee', weight: '500g', quantity: 2, subtotal: 1300 }],
      subtotal: 1300,
      couponCode: 'FESTIVE15',
      checkoutUrl: 'https://www.agricola.co.in/cart'
    });

    expect(emailData.html).toContain('Organic Desi Ghee');
    expect(emailData.html).toContain('FESTIVE15');
    expect(emailData.html).toContain('₹1300');
    expect(emailData.html).toContain('Complete Your Order');
    expect(emailData.text).toContain('FESTIVE15');
  });

  test('records and retrieves AbandonedCartLog documents', async () => {
    const log = await AbandonedCartLog.create({
      user: user1._id,
      recipientName: 'Aditi Roy',
      recipientEmail: 'aditi@example.com',
      channel: 'email',
      subject: 'Cart reminder',
      messageContent: 'Your cart is waiting',
      couponCode: 'AGRI10',
      cartValue: 1300,
      status: 'sent'
    });

    expect(log._id).toBeDefined();
    expect(log.channel).toBe('email');

    const found = await AbandonedCartLog.findOne({ user: user1._id });
    expect(found).not.toBeNull();
    expect(found.couponCode).toBe('AGRI10');
  });
});
