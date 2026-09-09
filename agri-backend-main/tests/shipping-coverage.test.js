// Coverage union in utils/shipping: a pincode either carrier can deliver to is
// serviceable, the covering carrier is reported, and the fallback carrier is only
// contacted when the primary can't answer. No DB or network required (both clients in
// mock mode; specific outcomes are forced with spies).
process.env.SHIPPING_PROVIDER = 'shiprocket';
process.env.SHIPROCKET_MOCK = 'true';
process.env.EKART_MOCK = 'true';

const shipping = require('../src/utils/shipping');
const shiprocket = require('../src/utils/shiprocket');
const ekart = require('../src/utils/ekart');

// The cache is process-wide and deliberately survives calls, so reset it per test.
beforeEach(() => shipping._clearCoverageCache());

const notServiceable = (pincode) => ({
  pincode: String(pincode),
  serviceable: false,
  cod: false,
  city: null,
  state: null,
  charge: null,
  eta: null,
  courierName: null
});

describe('getCoverage: provider selection', () => {
  it('answers from the active provider and never touches the fallback', async () => {
    const ekartSpy = jest.spyOn(ekart, 'getServiceability');

    const res = await shipping.getCoverage('411001');

    expect(res.serviceable).toBe(true);
    expect(res.provider).toBe('shiprocket');
    expect(res.city).toBe('Mock City');
    expect(ekartSpy).not.toHaveBeenCalled(); // no latency penalty for the secondary
    expect(res.attempts).toEqual([{ provider: 'shiprocket', serviceable: true, cached: false }]);
  });

  it('falls through to the other carrier when the active one says no', async () => {
    jest.spyOn(shiprocket, 'getServiceability').mockResolvedValue(notServiceable('799999'));

    const res = await shipping.getCoverage('799999');

    expect(res.serviceable).toBe(true);
    expect(res.provider).toBe('ekart'); // ekart's mock covers everything
    expect(res.attempts.map((a) => a.provider)).toEqual(['shiprocket', 'ekart']);
  });

  it('falls through when the active carrier errors (e.g. dead credentials)', async () => {
    jest.spyOn(shiprocket, 'getServiceability').mockRejectedValue(new Error('401 INVALID_USERNAME_PASSWORD'));

    const res = await shipping.getCoverage('411001');

    expect(res.serviceable).toBe(true);
    expect(res.provider).toBe('ekart');
    expect(res.attempts[0]).toMatchObject({ provider: 'shiprocket', error: expect.any(String) });
  });

  it('reports not serviceable only when every carrier that answered said no', async () => {
    jest.spyOn(shiprocket, 'getServiceability').mockResolvedValue(notServiceable('799999'));
    jest.spyOn(ekart, 'getServiceability').mockResolvedValue(notServiceable('799999'));

    const res = await shipping.getCoverage('799999');

    expect(res.serviceable).toBe(false);
    expect(res.provider).toBeNull();
    expect(res.unverified).toBeUndefined();
    expect(res.attempts).toHaveLength(2);
  });

  it('fails OPEN when no carrier could answer at all', async () => {
    jest.spyOn(shiprocket, 'getServiceability').mockRejectedValue(new Error('timeout'));
    jest.spyOn(ekart, 'getServiceability').mockRejectedValue(new Error('timeout'));

    const res = await shipping.getCoverage('411001');

    expect(res).toMatchObject({ serviceable: true, unverified: true, provider: null });
  });

  it('skips a carrier that is not configured', async () => {
    jest.spyOn(ekart, 'isConfigured').mockReturnValue(false);
    const ekartSpy = jest.spyOn(ekart, 'getServiceability');
    jest.spyOn(shiprocket, 'getServiceability').mockResolvedValue(notServiceable('799999'));

    const res = await shipping.getCoverage('799999');

    expect(res.serviceable).toBe(false);
    expect(ekartSpy).not.toHaveBeenCalled();
    expect(res.attempts[1]).toEqual({ provider: 'ekart', skipped: 'unconfigured' });
  });

  it('honours SHIPPING_PROVIDER for which carrier is asked first', async () => {
    process.env.SHIPPING_PROVIDER = 'ekart';
    try {
      const spy = jest.spyOn(shiprocket, 'getServiceability');
      const res = await shipping.getCoverage('411001');
      expect(res.provider).toBe('ekart');
      expect(spy).not.toHaveBeenCalled();
    } finally {
      process.env.SHIPPING_PROVIDER = 'shiprocket';
    }
  });
});

describe('getCoverage: place-name normalization', () => {
  // Live Shiprocket answers "UTTAR PRADESH" for 201301 but "Maharashtra" for 411001,
  // and Ekart sends state codes. The storefront State dropdown only matches the
  // canonical title-case spelling, so normalize before it reaches the customer.
  it.each([
    ['UTTAR PRADESH', 'GHAZIABAD', 'Uttar Pradesh', 'Ghaziabad'],
    ['ASSAM', 'GUWAHATI', 'Assam', 'Guwahati'],
    ['Maharashtra', 'Pune', 'Maharashtra', 'Pune'],
    ['KA', 'bengaluru', 'Karnataka', 'Bengaluru'],
    ['Orissa', 'CUTTACK', 'Odisha', 'Cuttack'],
    ['ANDAMAN AND NICOBAR ISLANDS', 'port blair', 'Andaman and Nicobar Islands', 'Port Blair']
  ])('maps %s / %s to %s / %s', async (rawState, rawCity, state, city) => {
    jest.spyOn(shiprocket, 'getServiceability').mockResolvedValue({
      pincode: '201301', serviceable: true, cod: true, city: rawCity, state: rawState, charge: 117, eta: null
    });

    const res = await shipping.getCoverage('201301');

    expect(res.state).toBe(state);
    expect(res.city).toBe(city);
  });
});

describe('getCoverage: cart context and cache', () => {
  it('returns a real charge and ETA when given cart context', async () => {
    const res = await shipping.getCoverage('411001', { weight: 0.7, declaredValue: 600 });

    expect(res.charge).toBeGreaterThan(0);
    expect(res.eta).toMatchObject({ date: expect.any(String) });
    expect(res.courierName).toBe('Mock Surface'); // cheapest of the mock couriers
  });

  it('serves a repeat lookup from cache instead of calling the carrier again', async () => {
    const spy = jest.spyOn(shiprocket, 'getServiceability');

    const first = await shipping.getCoverage('411001');
    const second = await shipping.getCoverage('411001');

    expect(spy).toHaveBeenCalledTimes(1);
    expect(second.serviceable).toBe(first.serviceable);
    expect(second.attempts[0].cached).toBe(true);
  });

  it('caches negatives too, so an unserviceable pincode is only asked once', async () => {
    const srSpy = jest.spyOn(shiprocket, 'getServiceability').mockResolvedValue(notServiceable('799999'));
    const ekSpy = jest.spyOn(ekart, 'getServiceability').mockResolvedValue(notServiceable('799999'));

    await shipping.getCoverage('799999');
    await shipping.getCoverage('799999');

    expect(srSpy).toHaveBeenCalledTimes(1);
    expect(ekSpy).toHaveBeenCalledTimes(1);
  });

  it('does not reuse a light-parcel quote for a much heavier cart', async () => {
    const spy = jest.spyOn(shiprocket, 'getServiceability');

    await shipping.getCoverage('411001', { weight: 0.5 });
    await shipping.getCoverage('411001', { weight: 5 });

    expect(spy).toHaveBeenCalledTimes(2); // different weight bucket
  });
});

describe('providerOfOrder', () => {
  it('uses the recorded provider', () => {
    expect(shipping.providerOfOrder({ shipping: { provider: 'ekart' } })).toBe('ekart');
    expect(shipping.providerOfOrder({ shipping: { provider: 'shiprocket' } })).toBe('shiprocket');
  });

  it('infers Ekart for orders booked before the provider field existed', () => {
    expect(shipping.providerOfOrder({ shipping: { ekartShipmentId: 'LUAP0001399452' } })).toBe('ekart');
    expect(shipping.providerOfOrder({ shipping: { carrier: 'Ekart' } })).toBe('ekart');
  });

  it('returns null when there is nothing to go on', () => {
    expect(shipping.providerOfOrder({ shipping: {} })).toBeNull();
    expect(shipping.providerOfOrder({})).toBeNull();
  });
});
