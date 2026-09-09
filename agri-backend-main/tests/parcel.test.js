// Parcel weight derivation. The catalog's admin UI only sets pack sizes
// (product.sizes -> "200g", copied onto every cart/order line as item.weight), and
// never product.weight.value — so the pack size has to be the primary source or every
// line falls back to the 0.5kg default.
const { parseSizeToKg, toKg, unitWeightKg, totalWeightKg, parcelDimsCm, defaultDimsCm, MIN_PARCEL_KG } = require('../src/utils/parcel');

describe('parseSizeToKg', () => {
  it.each([
    ['200g', 0.2],
    ['30g', 0.03],
    ['1kg', 1],
    ['5kg', 5],
    ['1 KG', 1],
    ['1.5kg', 1.5],
    ['500 g', 0.5],
    ['250gm', 0.25],
    ['2 lbs', 0.907184]
  ])('parses %s', (label, kg) => {
    expect(parseSizeToKg(label)).toBeCloseTo(kg, 5);
  });

  it.each([['Small'], ['500ml'], [''], [null], [undefined], ['g'], ['0g']])(
    'returns null for %s (not a usable weight)',
    (label) => {
      expect(parseSizeToKg(label)).toBeNull();
    }
  );
});

describe('toKg', () => {
  it('honours the unit instead of treating the number as kilograms', () => {
    // The bug this replaces: {value: 250, unit: 'g'} read raw quoted a 250kg parcel.
    expect(toKg(250, 'g')).toBe(0.25);
    expect(toKg(0.2, 'kg')).toBe(0.2);
    expect(toKg(1, 'lb')).toBeCloseTo(0.453592, 6);
    expect(toKg(2, undefined)).toBe(2); // kg is the schema default
  });

  it('rejects missing or non-positive values', () => {
    expect(toKg(0, 'g')).toBeNull();
    expect(toKg(undefined, 'kg')).toBeNull();
    expect(toKg('abc', 'kg')).toBeNull();
  });
});

describe('unitWeightKg precedence', () => {
  it('prefers the selected pack size on the line', () => {
    const product = { weight: { value: 5, unit: 'kg' }, sizes: ['200g', '1kg'] };
    expect(unitWeightKg({ sizeLabel: '200g', product })).toBe(0.2);
  });

  it('falls back to the product weight, unit-aware', () => {
    expect(unitWeightKg({ sizeLabel: null, product: { weight: { value: 250, unit: 'g' } } })).toBe(0.25);
  });

  it('falls back to a single-size product when the line carries no label', () => {
    // The live P007 case: weight.value unset, one size offered.
    expect(unitWeightKg({ sizeLabel: null, product: { weight: { unit: 'kg' }, sizes: ['200g'] } })).toBe(0.2);
  });

  it('does not guess when a product offers several sizes', () => {
    expect(unitWeightKg({ sizeLabel: null, product: { sizes: ['200g', '1kg'] } })).toBe(MIN_PARCEL_KG);
  });

  it('defaults to the minimum billable weight with nothing to go on', () => {
    expect(unitWeightKg({})).toBe(MIN_PARCEL_KG);
    expect(unitWeightKg({ sizeLabel: 'Small', product: {} })).toBe(MIN_PARCEL_KG);
  });
});

describe('totalWeightKg', () => {
  it('multiplies by quantity and accepts either qty field name', () => {
    const product = { weight: { unit: 'kg' }, sizes: ['200g'] };
    expect(totalWeightKg([{ weight: '200g', quantity: 3, product }])).toBeCloseTo(0.6, 5);
    expect(totalWeightKg([{ weight: '200g', qty: 2, product }])).toBeCloseTo(0.4, 5);
  });

  it('sums mixed lines', () => {
    expect(
      totalWeightKg([
        { weight: '200g', quantity: 2, product: {} },
        { weight: '1kg', quantity: 1, product: {} }
      ])
    ).toBeCloseTo(1.4, 5);
  });

  it('is the honest weight for the live catalog: 3 x 200g is 0.6kg, not 1.5kg', () => {
    const p007 = { weight: { unit: 'kg' }, sizes: ['200g'] }; // no weight.value, as in prod
    expect(totalWeightKg([{ weight: '200g', quantity: 3, product: p007 }])).toBeCloseTo(0.6, 5);
  });
});

describe('parcelDimsCm', () => {
  const measured = { dimensions: { length: 15, width: 10, height: 6, unit: 'cm' } };

  it('stacks real per-item heights by quantity and keeps the widest footprint', () => {
    expect(
      parcelDimsCm([
        { quantity: 2, product: measured },
        { quantity: 1, product: { dimensions: { length: 12, width: 8, height: 5, unit: 'cm' } } }
      ])
    ).toEqual({ length: 15, width: 10, height: 17 }); // 6+6+5
  });

  it('converts inches', () => {
    expect(parcelDimsCm([{ quantity: 1, product: { dimensions: { length: 10, width: 4, height: 2, unit: 'inch' } } }]))
      .toEqual({ length: 25, width: 10, height: 5 });
  });

  it('applies the default box ONCE for products with no dimensions', () => {
    // The bug this replaces: 3 dimensionless pouches booked as a 20x20x30 tower, i.e.
    // 2.4kg of volumetric weight against a parcel that weighs 0.6kg.
    const dimensionless = { weight: { unit: 'kg' }, sizes: ['200g'] };
    expect(parcelDimsCm([{ quantity: 1, product: dimensionless }])).toEqual({ length: 20, width: 20, height: 10 });
    expect(parcelDimsCm([{ quantity: 3, product: dimensionless }])).toEqual({ length: 20, width: 20, height: 10 });
  });

  it('ignores the default when at least one line has real dimensions', () => {
    expect(parcelDimsCm([{ quantity: 1, product: measured }, { quantity: 4, product: {} }]))
      .toEqual({ length: 15, width: 10, height: 6 });
  });

  it('falls back to the default box for an empty parcel', () => {
    expect(parcelDimsCm([])).toEqual({ length: 20, width: 20, height: 10 });
  });
});

describe('defaultDimsCm', () => {
  it('is env-tunable, since volumetric weight is billed off it', () => {
    expect(defaultDimsCm()).toEqual({ length: 20, width: 20, height: 10 });
    process.env.PARCEL_DEFAULT_LENGTH_CM = '25';
    process.env.PARCEL_DEFAULT_HEIGHT_CM = '4';
    try {
      expect(defaultDimsCm()).toEqual({ length: 25, width: 20, height: 4 });
    } finally {
      delete process.env.PARCEL_DEFAULT_LENGTH_CM;
      delete process.env.PARCEL_DEFAULT_HEIGHT_CM;
    }
  });
});
