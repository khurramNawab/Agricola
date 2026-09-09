// Unit tests for the Ekart client in mock mode. No DB or network required.
// Ekart has no sandbox, so these assert that (a) an Order maps to the real
// `shipment` schema correctly and (b) the mock responses match the spec shapes.

// Force mock mode BEFORE requiring the client (env is read per-call, but make it
// explicit and independent of .env.test).
process.env.EKART_MOCK = 'true';
process.env.WAREHOUSE_PINCODE = '560001';
process.env.WAREHOUSE_PHONE = '+919800000000';
process.env.EKART_SELLER_GST_TIN = '29ABCDE1234F1Z5';
delete process.env.EKART_PICKUP_ALIAS;
delete process.env.EKART_RETURN_ALIAS;

const ekart = require('../src/utils/ekart');

const makeOrder = (overrides = {}) => ({
  orderId: 'ORD-20260615-1234',
  createdAt: new Date('2026-06-15T00:00:00Z'),
  paymentMethod: 'razorpay',
  pricing: { subtotal: 1180, tax: 180, shipping: 50, total: 1230 },
  shippingAddress: {
    name: 'Asha Customer',
    phone: '+91 98765 43210',
    street: '12 MG Road',
    city: 'Pune',
    state: 'Maharashtra',
    pincode: '411001',
    country: 'India'
  },
  items: [
    {
      name: 'Assam CTC Tea',
      quantity: 2,
      subtotal: 900,
      product: { weight: { value: 250, unit: 'g' }, dimensions: { length: 15, width: 10, height: 6, unit: 'cm' } }
    },
    {
      name: 'Green Tea',
      quantity: 1,
      subtotal: 280,
      product: { weight: { value: 0.2, unit: 'kg' }, dimensions: { length: 12, width: 8, height: 5, unit: 'cm' } }
    }
  ],
  ...overrides
});

describe('ekart.buildShipmentPayload', () => {
  it('maps an order to the Ekart shipment schema (prepaid)', () => {
    const p = ekart.buildShipmentPayload(makeOrder());

    expect(p.order_number).toBe('ORD-20260615-1234');
    expect(p.invoice_number).toBe('ORD-20260615-1234');
    expect(p.invoice_date).toBe('2026-06-15');
    expect(p.payment_mode).toBe('Prepaid');
    expect(p.cod_amount).toBe(0);

    // Invoice invariant: total_amount === taxable_amount + tax_value
    expect(p.total_amount).toBe(1180);
    expect(p.tax_value).toBe(180);
    expect(p.taxable_amount).toBe(1000);
    expect(p.commodity_value).toBe('1000');

    // weight in grams: 250*2 + 200 = 700; quantity = 3
    expect(p.weight).toBe(700);
    expect(p.quantity).toBe(3);

    // dimensions in cm (integers, height summed across qty, capped)
    expect(p.length).toBe(15);
    expect(p.width).toBe(10);
    expect(p.height).toBe(17); // 6*2 + 5

    // drop_location: phone/pin are integers per locationV1
    expect(p.drop_location.phone).toBe(9876543210);
    expect(p.drop_location.pin).toBe(411001);
    expect(p.drop_location.city).toBe('Pune');

    // pickup_location built from warehouse env (no alias set)
    expect(p.pickup_location.pin).toBe(560001);
    expect(p.pickup_location.phone).toBe(9800000000);
    expect(p.return_location).toEqual(p.pickup_location);

    expect(p.seller_gst_tin).toBe('29ABCDE1234F1Z5');
  });

  it('sets COD fields for cash-on-delivery orders', () => {
    const p = ekart.buildShipmentPayload(makeOrder({ paymentMethod: 'cod' }));
    expect(p.payment_mode).toBe('COD');
    expect(p.cod_amount).toBe(1230); // order total
  });

  it('caps cod_amount at the API maximum (49999)', () => {
    const order = makeOrder({ paymentMethod: 'cod', pricing: { subtotal: 60000, tax: 0, shipping: 0, total: 60000 } });
    const p = ekart.buildShipmentPayload(order);
    expect(p.cod_amount).toBe(49999);
  });

  it('uses the pickup alias when configured', () => {
    process.env.EKART_PICKUP_ALIAS = 'main-wh';
    const p = ekart.buildShipmentPayload(makeOrder());
    expect(p.pickup_location).toEqual({ name: 'main-wh' });
    delete process.env.EKART_PICKUP_ALIAS;
  });
});

describe('ekart mock responses', () => {
  it('createShipment returns a normalized, spec-shaped result', async () => {
    const res = await ekart.createShipment(makeOrder(), { serviceType: 'standard' });
    expect(res.carrier).toBe('Ekart');
    expect(res.awbNumber).toMatch(/^MOCK\d+EK$/);
    expect(res.shipmentId).toBe(res.awbNumber);
    expect(res.vendorWaybill).toEqual(expect.any(String));
    expect(res.trackingUrl).toContain(res.awbNumber);
    expect(res.raw.status).toBe(true);
    expect(res.raw.barcodes.order).toBe('ORD-20260615-1234');
  });

  it('trackShipment returns normalized events', async () => {
    const t = await ekart.trackShipment('MOCK00000001EK');
    expect(t.status).toBe('In Transit');
    expect(Array.isArray(t.events)).toBe(true);
    expect(t.events.length).toBeGreaterThan(0);
    expect(t.events[0]).toHaveProperty('status');
    expect(t.events[0]).toHaveProperty('timestamp');
  });

  it('cancelShipment resolves on a successful ack', async () => {
    const c = await ekart.cancelShipment('MOCK00000001EK', 'test');
    expect(c.trackingId).toBe('MOCK00000001EK');
    expect(c.remark).toMatch(/cancel/i);
  });

  it('getShippingCharge returns a numeric rupee charge', async () => {
    const charge = await ekart.getShippingCharge({ toPincode: '411001', weight: 0.7, declaredValue: 1180 });
    expect(typeof charge).toBe('number');
    expect(charge).toBeGreaterThan(0);
  });

  it('checkServiceability returns the serviceability ack', async () => {
    const s = await ekart.checkServiceability('560001');
    expect(s.status).toBe(true);
    expect(s.details.cod).toBe(true);
  });

  it('isConfigured is true in mock mode', () => {
    expect(ekart.isConfigured()).toBe(true);
    expect(ekart.isMock()).toBe(true);
  });
});

describe('ekart webhook registration', () => {
  it('registers a webhook with the spec topics and returns an id', async () => {
    const res = await ekart.registerWebhook({
      url: 'https://api.agricola.co.in/api/v1/shipping/webhook',
      secret: 'a-valid-secret-123',
    });
    expect(res.id).toEqual(expect.any(String));
    expect(res.url).toBe('https://api.agricola.co.in/api/v1/shipping/webhook');
    expect(res.topics).toEqual(['track_updated', 'shipment_created', 'shipment_recreated']);
    expect(res.active).toBe(true);
  });

  it('lists registered webhooks', async () => {
    const list = await ekart.listWebhooks();
    expect(Array.isArray(list)).toBe(true);
    expect(list.some((w) => w.url === 'https://api.agricola.co.in/api/v1/shipping/webhook')).toBe(true);
  });

  it('rejects a secret outside the 6-30 char range', async () => {
    await expect(
      ekart.registerWebhook({ url: 'https://x.test/webhook', secret: 'short' })
    ).rejects.toThrow(/6-30 characters/);
  });
});
