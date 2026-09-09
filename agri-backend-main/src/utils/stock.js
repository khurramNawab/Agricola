const Product = require('../models/Product');
const ProductWarehouseStock = require('../models/ProductWarehouseStock');

/**
 * Restores product stock for all items in an order.
 * @param {object} order - Mongoose Order document or plain object containing items
 */
const restoreOrderStock = async (order) => {
  if (!order || !Array.isArray(order.items)) return;
  for (const item of order.items) {
    const productId = item.product?._id || item.product;
    if (productId && item.quantity > 0) {
      // 1. Restore global Product.stock
      await Product.updateOne(
        { _id: productId },
        { $inc: { stock: item.quantity } }
      );
      // 2. Restore ProductWarehouseStock if a warehouse was assigned
      if (order.warehouse) {
        const warehouseId = order.warehouse._id || order.warehouse;
        await ProductWarehouseStock.updateOne(
          { product: productId, warehouse: warehouseId },
          { $inc: { stock: item.quantity } }
        );
      }
    }
  }
};

module.exports = {
  restoreOrderStock
};

