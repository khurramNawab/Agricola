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
    expect(p).toEqual({ weight: 0.5, length: 20, breadth: 20, height: 10 });
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
