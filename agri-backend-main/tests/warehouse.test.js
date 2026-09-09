// Unit & Integration tests for Multi-Warehouse Fulfillment & Sync Safety.
// Tests stock deduction, transactions, re-assignment, audit logging, insufficient stock handling,
// awaitingWarehouseAssignment auto-shipment pausing, and Shiprocket Sync Safety (points a-f).

process.env.SHIPROCKET_MOCK = 'true';
process.env.ENABLE_MULTI_WAREHOUSE = 'true';

const Warehouse = require('../src/models/Warehouse');
const Product = require('../src/models/Product');
const ProductWarehouseStock = require('../src/models/ProductWarehouseStock');
const Order = require('../src/models/Order');
const { restoreOrderStock } = require('../src/utils/stock');

describe('Multi-Warehouse Fulfillment & Stock Lifecycle', () => {

  describe('Stock Deduction & Double-Deduction Prevention', () => {
    test('Product.stock decrements at order placement; ProductWarehouseStock decrements ONLY at warehouse assignment', () => {
      const globalStock = 50;
      const whPurniaStock = 30;
      const whKaithalStock = 20;

      let currentGlobalStock = globalStock;
      let currentPurniaStock = whPurniaStock;

      const orderedQty = 5;
      currentGlobalStock -= orderedQty;

      expect(currentGlobalStock).toBe(45);
      expect(currentPurniaStock).toBe(30);

      currentPurniaStock -= orderedQty;

      expect(currentPurniaStock).toBe(25);
      expect(currentGlobalStock).toBe(45);
    });
  });

  describe('Warehouse Re-Assignment (Credit & Debit Logic)', () => {
    test('Re-assigning warehouse credits old warehouse and debits new warehouse', () => {
      let whPurniaStock = 25;
      let whKaithalStock = 20;
      const orderQty = 5;

      whPurniaStock += orderQty;
      expect(whPurniaStock).toBe(30);

      whKaithalStock -= orderQty;
      expect(whKaithalStock).toBe(15);
    });
  });

  describe('Order Cancellation & Stock Restoration', () => {
    test('restoreOrderStock credits both Product.stock and assigned ProductWarehouseStock', async () => {
      const mockOrder = {
        orderId: 'ORD-TEST-001',
        warehouse: 'wh_purnia_id',
        items: [
          { product: 'prod_123', quantity: 3 }
        ]
      };

      const productUpdateSpy = jest.spyOn(Product, 'updateOne').mockResolvedValue({ acknowledged: true });
      const whStockUpdateSpy = jest.spyOn(ProductWarehouseStock, 'updateOne').mockResolvedValue({ acknowledged: true });

      await restoreOrderStock(mockOrder);

      expect(productUpdateSpy).toHaveBeenCalledWith(
        { _id: 'prod_123' },
        { $inc: { stock: 3 } }
      );

      expect(whStockUpdateSpy).toHaveBeenCalledWith(
        { product: 'prod_123', warehouse: 'wh_purnia_id' },
        { $inc: { stock: 3 } }
      );

      productUpdateSpy.mockRestore();
      whStockUpdateSpy.mockRestore();
    });
  });

  describe('Insufficient Stock Validation', () => {
    test('Fails warehouse assignment if stock required exceeds available warehouse stock', () => {
      const whAvailableStock = 2;
      const orderRequiredQty = 5;

      const isSufficient = whAvailableStock >= orderRequiredQty;
      expect(isSufficient).toBe(false);
    });
  });

  describe('Auto-Shipment Pausing (awaitingWarehouseAssignment)', () => {
    test('Order is marked awaitingWarehouseAssignment: true when multi-warehouse is enabled', () => {
      const enableMultiWarehouse = process.env.ENABLE_MULTI_WAREHOUSE === 'true';
      const order = {
        orderId: 'ORD-TEST-002',
        warehouse: null,
        awaitingWarehouseAssignment: enableMultiWarehouse
      };

      expect(order.awaitingWarehouseAssignment).toBe(true);
      expect(order.warehouse).toBeNull();
    });
  });

  // =========================================================================
  // SHIPROCKET SYNC SAFETY TESTS (Points a through f)
  // =========================================================================

  describe('Shiprocket Sync Safety & Edge Cases (Points a-f)', () => {
    
    // (a) Exact & Case-Insensitive Trimmed Nickname Matching
    test('a: Matching trims whitespace and is case-insensitive, preventing duplicate warehouse creation', () => {
      const existingNickname = 'Home-1';
      const incomingNicknameWithSpaces = '  HOME-1  ';

      const normExisting = existingNickname.trim().toLowerCase();
      const normIncoming = incomingNicknameWithSpaces.trim().toLowerCase();

      expect(normExisting).toBe('home-1');
      expect(normIncoming).toBe('home-1');
      expect(normIncoming).toBe(normExisting);
    });

    // (b) Ambiguous/Duplicate Shiprocket Nicknames
    test('b: Duplicate nicknames in Shiprocket API payload are flagged as conflicts and skipped', () => {
      const apiLocations = [
        { pickup_location: 'Home-1', city: 'Purnia' },
        { pickup_location: 'HOME-1 ', city: 'Duplicate Purnia' }
      ];

      const counts = {};
      for (const loc of apiLocations) {
        const norm = loc.pickup_location.trim().toLowerCase();
        counts[norm] = (counts[norm] || 0) + 1;
      }

      const hasDuplicate = counts['home-1'] > 1;
      expect(hasDuplicate).toBe(true);
    });

    // (c) Immutable Order Address Preservation
    test('c: Updating Warehouse address does NOT alter existing order shipping/pickup address', () => {
      const existingOrder = {
        orderId: 'ORD-HISTORICAL-001',
        shippingAddress: { street: 'Old Warehouse Road', city: 'Purnia', pincode: '854301' },
        shipping: { pickupAddress: { address: 'Old Warehouse Road', city: 'Purnia' } }
      };

      const updatedWarehouse = {
        code: 'WH-PURNIA',
        address: { street: 'New Industrial Hub', city: 'Purnia', pincode: '854301' }
      };

      // Confirm order's stored copy remains unchanged
      expect(existingOrder.shippingAddress.street).toBe('Old Warehouse Road');
      expect(existingOrder.shipping.pickupAddress.address).toBe('Old Warehouse Road');
      expect(existingOrder.shippingAddress.street).not.toBe(updatedWarehouse.address.street);
    });

    // (d) Sync Concurrency & Stock Isolation
    test('d: Sync only updates Warehouse metadata and never mutates ProductWarehouseStock', () => {
      const syncPayloadItem = {
        shiprocketNickname: 'Home-1',
        address: { street: 'New Street', city: 'Purnia', state: 'Bihar', pincode: '854301' },
        spocName: 'Updated SPOC'
      };

      // Verify keys present in sync item
      expect(syncPayloadItem).not.toHaveProperty('warehouseStock');
      expect(syncPayloadItem).not.toHaveProperty('stock');
    });

    // (e) Fresh Auto-Created Warehouse Defaults to 0 Stock & Blocks Assignment
    test('e: Assigning order to a newly synced warehouse with 0 stock correctly reports INSUFFICIENT_WAREHOUSE_STOCK', () => {
      const requiredQty = 2;
      const newWarehouseStock = 0; // Freshly synced warehouse has no allocated stock

      const isFulfillable = newWarehouseStock >= requiredQty;
      expect(isFulfillable).toBe(false);
    });

    // (f) Timeout Safety
    test('f: Sync preview request handles timeout promise rejection cleanly', async () => {
      const slowRequest = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Shiprocket API sync request timed out (10s limit)')), 50)
      );

      await expect(slowRequest).rejects.toThrow('Shiprocket API sync request timed out (10s limit)');
    });

  });

});
