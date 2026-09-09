const mongoose = require('mongoose');

const productWarehouseStockSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  warehouse: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Warehouse',
    required: true,
    index: true
  },
  stock: {
    type: Number,
    required: true,
    min: [0, 'Stock cannot be negative'],
    default: 0
  }
}, {
  timestamps: true
});

// Compound unique index so each product has at most one stock record per warehouse
productWarehouseStockSchema.index({ product: 1, warehouse: 1 }, { unique: true });

module.exports = mongoose.models.ProductWarehouseStock || mongoose.model('ProductWarehouseStock', productWarehouseStockSchema);
