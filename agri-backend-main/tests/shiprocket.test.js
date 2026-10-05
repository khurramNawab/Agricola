// Unit tests for the Shiprocket client in mock mode. No DB or network required.
// Shiprocket has no sandbox, so these assert that (a) an Order maps to the adhoc-order
// schema correctly, (b) rates/serviceability normalize as the app expects, and (c) the
// provider facade routes to the right client.

// Force mock mode BEFORE requiring the client (env is read per-call, but make it
// explicit and independent of .env.test).
process.env.SHIPROCKET_MOCK = 'true';
process.env.SHIPROCKET_PICKUP_LOCATION = 'Home';
process.env.WAREHOUSE_PINCODE = '136027';
delete process.env.SHIPROCKET_COURIER_ID;
delete process.env.SHIPROCKET_CHANNEL_ID;

const shiprocket = require('../src/utils/shiprocket');

const makeOrder = (overrides = {}) => ({
  orderId: 'ORD-20260615-1234',
  createdAt: new Date('2026-06-15T09:30:00Z'),
  paymentMethod: 'razorpay',
  email: 'asha@example.com',
  pricing: { subtotal: 1180, tax: 0, discount: 180, shipping: 50, total: 1050 },
  shippingAddress: {
    name: 'Asha Kumari Customer',
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
      weight: '250g',
      price: 450,
      quantity: 2,
      subtotal: 900,
      product: { _id: 'p1', productId: 'PRD-001', weight: { value: 250, unit: 'g' }, dimensions: { length: 15, width: 10, height: 6, unit: 'cm' } }
    },
    {
      name: 'Green Tea',
      weight: '200g',
      price: 280,
      quantity: 1,
      subtotal: 280,
      product: { _id: 'p2', productId: 'PRD-002', weight: { value: 0.2, unit: 'kg' }, dimensions: { length: 12, width: 8, height: 5, unit: 'cm' } }
    }
  ],
  ...overrides
});

describe('shiprocket.measureParcel', () => {
  it('sums weight in kg and stacks height, keeping the max footprint', () => {
    const p = shiprocket.measureParcel(makeOrder().items);
    expect(p.weight).toBe(0.7);   // 2 x 250g + 200g
    expect(p.length).toBe(15);    // max length
    expect(p.breadth).toBe(10);   // max width
    expect(p.height).toBe(17);    // 6+6+5 stacked
  });

  it('enforces Shiprocket\'s 0.5kg minimum billable weight', () => {
    const p = shiprocket.measureParcel([
      { quantity: 1, product: { weight: { value: 50, unit: 'g' } } }
    ]);
    expect(p.weight).toBe(0.5);
  });

  it('falls back to defaults when a product has no weight/dimensions', () => {
    const p = shiprocket.measureParcel([{ quantity: 1, product: {} }]);
    expect(p).toEqual({ weight: 0.5, length: 15, breadth: 6, height: 25 });
  });

  it('correctly uses custom product dimensions configured from the admin panel', () => {
    const customProduct = {
      name: 'Special Makhana Jar',
      dimensions: { length: 18, width: 8, height: 20, unit: 'cm' },
      sizes: ['250g']
    };
    const p = shiprocket.measureParcel([{ quantity: 2, product: customProduct, weight: '250g' }]);
    expect(p).toEqual({
      weight: 0.5,   // 2 x 250g = 500g
      length: 18,
      breadth: 8,
      height: 40     // 20cm x 2 units stacked
    });
  });
});

describe('shiprocket.buildOrderPayload', () => {
  it('maps an order to the adhoc-order schema (prepaid)', () => {
    const p = shiprocket.buildOrderPayload(makeOrder());

    expect(p.order_id).toBe('ORD-20260615-1234');
    expect(p.order_date).toBe('2026-06-15 09:30:00');
    expect(p.pickup_location).toBe('Home');
    expect(p.payment_method).toBe('Prepaid');

    // Name is split into first/last; phone normalized to 10 digits.
    expect(p.billing_customer_name).toBe('Asha');
    expect(p.billing_last_name).toBe('Kumari Customer');
    expect(p.billing_phone).toBe('9876543210');
    expect(p.billing_pincode).toBe('411001');
    expect(p.billing_state).toBe('Maharashtra');
    expect(p.billing_email).toBe('asha@example.com');
    expect(p.shipping_is_billing).toBe(true);

    // sub_total is the goods value net of discount (what the courier insures/collects).
    expect(p.sub_total).toBe(1000);

    expect(p.order_items).toEqual([
      { name: 'Assam CTC Tea 250g', sku: 'PRD-001', units: 2, selling_price: 450 },
      { name: 'Green Tea 200g', sku: 'PRD-002', units: 1, selling_price: 280 }
    ]);

    // Parcel dimensions ride along on the same payload.
    expect(p).toMatchObject({ weight: 0.7, length: 15, breadth: 10, height: 17 });
    expect(p.channel_id).toBeUndefined();
  });

  it('marks COD orders and keeps a single-word name valid', () => {
    const p = shiprocket.buildOrderPayload(
      makeOrder({ paymentMethod: 'cod', shippingAddress: { ...makeOrder().shippingAddress, name: 'Asha' } })
    );
    expect(p.payment_method).toBe('COD');
    expect(p.billing_customer_name).toBe('Asha');
    expect(p.billing_last_name).toBe('');
  });

  it('includes channel_id only when configured', () => {
    process.env.SHIPROCKET_CHANNEL_ID = '123456';
    expect(shiprocket.buildOrderPayload(makeOrder()).channel_id).toBe('123456');
    delete process.env.SHIPROCKET_CHANNEL_ID;
  });
});

describe('shiprocket rates', () => {
  it('returns couriers cheapest-first with the destination echoed back', async () => {
    const { couriers, destination, recommendedId } = await shiprocket.getRates({
      toPincode: '411001',
      weight: 0.7,
      declaredValue: 1000
    });

    expect(couriers.length).toBe(2);
    expect(couriers[0].rate).toBeLessThan(couriers[1].rate); // mock returns them unsorted
    expect(couriers[0].courierName).toBe('Mock Surface');
    expect(recommendedId).toBe(1);
    expect(destination).toEqual({ city: 'Mock City', state: 'Maharashtra' });
  });

  it('adds the COD fee into the rate when a COD amount is passed', async () => {
    const prepaid = await shiprocket.getRates({ toPincode: '411001', weight: 0.5 });
    const cod = await shiprocket.getRates({ toPincode: '411001', weight: 0.5, codAmount: 1050 });
    expect(cod.couriers[0].codCharge).toBe(35);
    expect(cod.couriers[0].rate).toBe(prepaid.couriers[0].rate + 35);
  });

  it('getShippingCharge quotes the cheapest courier, rounded', async () => {
    const charge = await shiprocket.getShippingCharge({ toPincode: '411001', weight: 0.7, declaredValue: 1000 });
    const { couriers } = await shiprocket.getRates({ toPincode: '411001', weight: 0.7, declaredValue: 1000 });
    expect(charge).toBe(Math.round(couriers[0].rate));
  });

  it('getShippingCharge returns null (flat-rate fallback) without a destination', async () => {
    expect(await shiprocket.getShippingCharge({ weight: 1 })).toBeNull();
  });

  it('getServiceability normalizes to serviceable + city/state', async () => {
    const s = await shiprocket.getServiceability('411001');
    expect(s).toMatchObject({ pincode: '411001', serviceable: true, cod: true, city: 'Mock City', state: 'Maharashtra' });
  });

  it('getServiceability carries the cheapest courier\'s charge and ETA for the real parcel', async () => {
    const light = await shiprocket.getServiceability('411001', { weight: 0.5, declaredValue: 500 });
    const heavy = await shiprocket.getServiceability('411001', { weight: 5, declaredValue: 500 });

    expect(light.courierName).toBe('Mock Surface'); // cheapest, not first in the response
    expect(light.charge).toBeGreaterThan(0);
    expect(light.eta).toMatchObject({ date: expect.any(String), days: expect.any(Number) });
    // Serviceability is the rate call, so a heavier parcel costs more from the same call.
    expect(heavy.charge).toBeGreaterThan(light.charge);
  });
});

describe('shiprocket.createShipment', () => {
  it('books an order, assigns an AWB and fetches the label', async () => {
    const shipment = await shiprocket.createShipment(makeOrder());

    expect(shipment.awbNumber).toMatch(/^MOCK\d{9}SR$/);
    expect(shipment.provider).toBe('shiprocket');
    expect(shipment.shipmentId).toMatch(/^\d+$/);
    expect(shipment.providerOrderId).toMatch(/^\d+$/);
    expect(shipment.carrier).toBe('Mock Surface');   // cheapest courier was selected
    expect(shipment.courierName).toBe('Mock Surface');
    expect(shipment.labelUrl).toContain('.pdf');
    expect(shipment.pickupScheduled).toBe(true);
    expect(shipment.serviceType).toBe('standard');   // enum-safe for order.shipping.method
  });

  it('honours an explicitly requested courier', async () => {
    const shipment = await shiprocket.createShipment(makeOrder(), { courierId: 1 });
    expect(shipment.carrier).toBe('Mock Air');
  });

  it('skips pickup and label when disabled', async () => {
    process.env.SHIPROCKET_REQUEST_PICKUP = 'false';
    process.env.SHIPROCKET_GENERATE_LABEL = 'false';
    const shipment = await shiprocket.createShipment(makeOrder());
    expect(shipment.pickupScheduled).toBe(false);
    expect(shipment.labelUrl).toBeNull();
    delete process.env.SHIPROCKET_REQUEST_PICKUP;
    delete process.env.SHIPROCKET_GENERATE_LABEL;
  });

  // =========================================================================
  // AWB ASSIGNMENT: Warehouse assign → populate → createShipment flow
  // Tests the exact path that assign-warehouse in admin.js uses.
  // =========================================================================

  it('populated product: createShipment uses real weight and dimensions (the fix)', async () => {
    // After admin.js does: await order.populate('items.product', 'name productId weight dimensions')
    const populatedOrder = makeOrder({
      items: [
        {
          name: 'Kaju Katli 250g',
          weight: '250g',
          price: 480,
          quantity: 3,
          subtotal: 1440,
          product: {
            _id: 'abc123',
            productId: 'PRD-KKT-250',
            name: 'Kaju Katli',
            weight: { value: 250, unit: 'g' },
            dimensions: { length: 16, width: 9, height: 7, unit: 'cm' }
          }
        }
      ]
    });

    // 1) Weight and dimensions must come from the populated product
    const parcel = shiprocket.measureParcel(populatedOrder.items);
    expect(parcel.weight).toBe(0.75);   // 3 × 250g
    expect(parcel.length).toBe(16);
    expect(parcel.breadth).toBe(9);
    expect(parcel.height).toBe(21);     // 7cm × 3 stacked

    // 2) buildOrderPayload must carry those into the Shiprocket schema
    const payload = shiprocket.buildOrderPayload(populatedOrder);
    expect(payload.weight).toBe(0.75);
    expect(payload.length).toBe(16);
    expect(payload.breadth).toBe(9);
    expect(payload.height).toBe(21);
    // SKU should be the real productId, not a random ObjectId
    expect(payload.order_items[0].sku).toBe('PRD-KKT-250');

    // 3) createShipment must yield a valid AWB
    const shipment = await shiprocket.createShipment(populatedOrder);
    expect(shipment.awbNumber).toMatch(/^MOCK\d{9}SR$/);
    expect(shipment.provider).toBe('shiprocket');
    expect(shipment.carrier).toBeTruthy();
    expect(shipment.trackingUrl).toContain(shipment.awbNumber);
    expect(shipment.labelUrl).toContain('.pdf');
    expect(shipment.pickupScheduled).toBe(true);
  });

  it('unpopulated ObjectId product: falls back to defaults (pre-fix scenario)', async () => {
    // This is what happened BEFORE the fix — product was a raw ObjectId string
    const unpopulatedOrder = makeOrder({
      items: [
        {
          name: 'Green Tea 100g',
          weight: '100g',
          price: 220,
          quantity: 1,
          subtotal: 220,
          product: '507f1f77bcf86cd799439011'
        }
      ]
    });

    // Parcel falls back: weight from "100g" label, dims from env defaults
    const parcel = shiprocket.measureParcel(unpopulatedOrder.items);
    expect(parcel.weight).toBe(0.5);     // 100g = 0.1kg, but min is 0.5
    expect(parcel.length).toBe(15);      // default
    expect(parcel.breadth).toBe(6);      // default
    expect(parcel.height).toBe(25);      // default (no product dims to stack)

    // buildOrderPayload uses ObjectId string as SKU when product is not an object
    const payload = shiprocket.buildOrderPayload(unpopulatedOrder);
    expect(payload.order_items[0].sku).toBe('507f1f77bcf86cd799439011');
    expect(payload.weight).toBe(0.5);

    // AWB must still be assigned (mock mode) — shipment never crashes
    const shipment = await shiprocket.createShipment(unpopulatedOrder);
    expect(shipment.awbNumber).toMatch(/^MOCK\d{9}SR$/);
    expect(shipment.provider).toBe('shiprocket');
  });

  it('applyShipment correctly stamps AWB and carrier on order after createShipment', async () => {
    const shipping = require('../src/utils/shipping');
    const order = makeOrder();
    order.shipping = {};
    order.pricing = { subtotal: 1000, shipping: 50, total: 1050, discount: 0, tax: 0 };

    const shipment = await shiprocket.createShipment(order);
    shipping.applyShipment(order, shipment);

    // The order now has everything the admin dashboard needs
    expect(order.shipping.trackingNumber).toMatch(/^MOCK\d{9}SR$/);
    expect(order.shipping.carrier).toBeTruthy();
    expect(order.shipping.provider).toBe('shiprocket');
    expect(order.shipping.providerShipmentId).toBeTruthy();
    expect(order.shipping.labelUrl).toContain('.pdf');
    expect(order.shipping.trackingUrl).toContain(order.shipping.trackingNumber);
    expect(order.shipping.method).toBe('standard');
  });

  it('multi-item order: stacks dimensions and sums weight from populated products', async () => {
    const multiItemOrder = makeOrder({
      items: [
        {
          name: 'Assam CTC Tea',
          weight: '500g',
          price: 450,
          quantity: 2,
          subtotal: 900,
          product: {
            _id: 'p1', productId: 'PRD-TEA-500',
            weight: { value: 500, unit: 'g' },
            dimensions: { length: 20, width: 12, height: 8, unit: 'cm' }
          }
        },
        {
          name: 'Honey 250g',
          weight: '250g',
          price: 350,
          quantity: 1,
          subtotal: 350,
          product: {
            _id: 'p2', productId: 'PRD-HON-250',
            weight: { value: 250, unit: 'g' },
            dimensions: { length: 10, width: 10, height: 12, unit: 'cm' }
          }
        }
      ]
    });

    // Weight: 2×500g + 1×250g = 1250g = 1.25kg
    const parcel = shiprocket.measureParcel(multiItemOrder.items);
    expect(parcel.weight).toBe(1.25);
    expect(parcel.length).toBe(20);     // max footprint
    expect(parcel.breadth).toBe(12);    // max footprint
    expect(parcel.height).toBe(28);     // 8×2 + 12×1 stacked

    const payload = shiprocket.buildOrderPayload(multiItemOrder);
    expect(payload.weight).toBe(1.25);
    expect(payload.length).toBe(20);
    expect(payload.height).toBe(28);
    expect(payload.order_items).toHaveLength(2);
    expect(payload.order_items.map(i => i.sku).sort()).toEqual(['PRD-HON-250', 'PRD-TEA-500']);

    const shipment = await shiprocket.createShipment(multiItemOrder);
    expect(shipment.awbNumber).toMatch(/^MOCK\d{9}SR$/);
    expect(shipment.shippingCharge).toBeGreaterThan(0);
  });

  it('warehouse nickname flows through to pickup_location in the Shiprocket payload', async () => {
    const order = makeOrder();
    const whObj = { shiprocketPickupNickname: 'Purnia-WH-1' };
    const payload = shiprocket.buildOrderPayload(order, whObj);
    expect(payload.pickup_location).toBe('Purnia-WH-1');
  });
});


describe('shiprocket.cancelShipment', () => {
  it('cancels by AWB when one exists', async () => {
    const res = await shiprocket.cancelShipment({ trackingNumber: 'MOCK000000001SR' });
    expect(res.remark).toBe('Shipment cancelled successfully');
  });

  it('falls back to cancelling the order when there is no AWB', async () => {
    const res = await shiprocket.cancelShipment({ providerOrderId: '9000001' });
    expect(res.remark).toBe('Order cancelled successfully');
  });

  it('rejects a call with neither identifier', async () => {
    await expect(shiprocket.cancelShipment({})).rejects.toThrow(/awb or order id/i);
  });
});

describe('shiprocket.trackShipment', () => {
  it('normalizes tracking into the shared shape (newest event first)', async () => {
    const t = await shiprocket.trackShipment('MOCK000000001SR');

    expect(t.trackingId).toBe('MOCK000000001SR');
    expect(t.status).toBe('In Transit');
    expect(t.description).toBe('Shipment in transit at hub');
    expect(t.location).toBe('Mock Hub');
    expect(t.estimatedDelivery).toBeInstanceOf(Date);
    expect(t.events).toHaveLength(3);
    expect(t.events[0]).toMatchObject({ status: 'IN TRANSIT', location: 'Mock Hub' });
    expect(t.events[0].timestamp).toBeInstanceOf(Date);
  });
});

describe('utils/shipping facade', () => {
  const shipping = require('../src/utils/shipping');
  const original = process.env.SHIPPING_PROVIDER;
  afterEach(() => { process.env.SHIPPING_PROVIDER = original; });

  it('defaults to shiprocket', () => {
    delete process.env.SHIPPING_PROVIDER;
    expect(shipping.providerName()).toBe('shiprocket');
  });

  it('routes to ekart when SHIPPING_PROVIDER=ekart', () => {
    process.env.SHIPPING_PROVIDER = 'ekart';
    expect(shipping.providerName()).toBe('ekart');
  });

  it('applyShipment persists the provider fields onto an order', () => {
    const order = {
      shipping: {},
      pricing: { shipping: 50 }
    };
    shipping.applyShipment(order, {
      awbNumber: 'MOCK000000001SR',
      carrier: 'Mock Surface',
      courierName: 'Mock Surface',
      provider: 'shiprocket',
      providerOrderId: '9000001',
      shipmentId: '8000001',
      labelUrl: 'https://example.test/label.pdf',
      trackingUrl: 'https://example.test/track',
      shippingCharge: 67,
      serviceType: 'standard'
    });

    expect(order.shipping).toMatchObject({
      method: 'standard',
      carrier: 'Mock Surface',
      trackingNumber: 'MOCK000000001SR',
      provider: 'shiprocket',
      courierName: 'Mock Surface',
      providerOrderId: '9000001',
      providerShipmentId: '8000001',
      labelUrl: 'https://example.test/label.pdf',
      cost: 67
    });
  });

  it('applyShipment falls back to the order pricing when no charge is returned', () => {
    const order = { shipping: {}, pricing: { shipping: 42 } };
    shipping.applyShipment(order, { awbNumber: 'A', carrier: 'C' });
    expect(order.shipping.cost).toBe(42);
  });
});
