// PDF invoice generation via pdfkit. Streams straight to the HTTP response.
// Uses "Rs." rather than the ₹ glyph, which the built-in Helvetica font can't render.
const PDFDocument = require('pdfkit');

const money = (n) => `Rs. ${Number(n || 0).toLocaleString('en-IN')}`;
const fmtDate = (d) =>
  new Date(d || Date.now()).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

/**
 * Single source of truth for invoice data across all formats (A4, 4x6, Shipping Label, Email).
 * Guarantees numbers and details match 100% across every invoice variant.
 */
function buildInvoiceData(order) {
  const defaultSellerName = process.env.SELLER_NAME || process.env.EKART_SELLER_NAME || 'AgriCola';
  const defaultSellerAddr = process.env.SELLER_ADDRESS || process.env.EKART_SELLER_ADDRESS || 'Flat No. 00, VPO Nauch, near PNB, Kaithal, Haryana 136027';
  const sellerGst = process.env.SELLER_GST_TIN || process.env.EKART_SELLER_GST_TIN || '06ACLFA9681L1ZP';

  const wh = order.warehouse && typeof order.warehouse === 'object' ? order.warehouse : null;
  const sellerName = wh ? `${defaultSellerName} (${wh.name || wh.code})` : defaultSellerName;
  const sellerAddr = wh && wh.address
    ? [wh.address.street, wh.address.city, wh.address.state, wh.address.pincode].filter(Boolean).join(', ')
    : defaultSellerAddr;

  const addr = order.shippingAddress || {};
  const user = order.user && typeof order.user === 'object' ? order.user : {};
  const s = order.shipping || {};
  const p = order.pricing || {};

  const isShippingWaived = Boolean(p.shippingWaived);
  const deliveryCharge = isShippingWaived ? 0 : (p.shipping || 0);
  const subtotal = p.subtotal || 0;
  const discount = p.discount || 0;
  const tax = p.tax || 0;
  const total = Math.max(0, subtotal - discount + tax + deliveryCharge);

  return {
    orderId: order.orderId,
    createdAt: order.createdAt,
    formattedDate: fmtDate(order.createdAt),
    paymentMethod: (order.paymentMethod || '-').toUpperCase(),
    paymentStatus: (order.paymentStatus || '-').toUpperCase(),
    isCOD: String(order.paymentMethod).toLowerCase() === 'cod',
    seller: {
      name: sellerName,
      address: sellerAddr,
      gstin: sellerGst,
      contact: wh && wh.spocPhone ? `${wh.spocName || 'Manager'} (${wh.spocPhone})` : '',
      facilityName: wh ? (wh.name || wh.code) : ''
    },
    customer: {
      name: addr.name || user.name || 'Customer',
      email: order.email || user.email || '',
      phone: addr.phone || user.phone || '',
      addressLine: [addr.street, addr.city, addr.state, addr.pincode].filter(Boolean).join(', '),
      street: addr.street || '',
      city: addr.city || '',
      state: addr.state || '',
      pincode: addr.pincode || ''
    },
    shipping: {
      trackingNumber: s.trackingNumber || '',
      carrier: s.courierName || s.carrier || '',
      hasAwb: Boolean(s.trackingNumber)
    },
    items: (order.items || []).map((it) => ({
      name: `${it.name}${it.weight ? ` (${it.weight})` : ''}`,
      rawName: it.name,
      weight: it.weight || '',
      quantity: it.quantity || 1,
      price: it.price || 0,
      subtotal: it.subtotal || ((it.price || 0) * (it.quantity || 1))
    })),
    pricing: {
      subtotal,
      discount,
      shipping: deliveryCharge,
      shippingWaived: isShippingWaived,
      tax,
      total
    }
  };
}

/**
 * Render standard A4 Tax Invoice onto a PDFDocument instance.
 */
function renderInvoiceDoc(order, doc) {
  const data = buildInvoiceData(order);

  // --- Header ---
  doc.fillColor('#84b817').fontSize(24).text('AgriCola', 50, 50);
  doc.fillColor('#333333').fontSize(14).text('Tax Invoice', 300, 55, { width: 195, align: 'right' });

  doc.fillColor('#666666').fontSize(9);
  let leftY = 82;
  doc.text(`Seller / Dispatcher: ${data.seller.name}`, 50, leftY, { width: 240 });
  leftY = doc.y;
  if (data.seller.address) { doc.text(`Origin: ${data.seller.address}`, 50, leftY, { width: 240 }); leftY = doc.y; }
  if (data.seller.contact) { doc.text(`Contact: ${data.seller.contact}`, 50, leftY, { width: 240 }); leftY = doc.y; }
  if (data.seller.gstin) doc.text(`GSTIN: ${data.seller.gstin}`, 50, leftY, { width: 240 });

  doc.fillColor('#333333').fontSize(10);
  doc.text(`Invoice No: ${data.orderId}`, 300, 82, { width: 195, align: 'right' });
  doc.text(`Date: ${data.formattedDate}`, 300, doc.y, { width: 195, align: 'right' });
  doc.text(`Payment: ${data.paymentMethod} (${data.paymentStatus})`, 300, doc.y, { width: 195, align: 'right' });

  const headerEndY = Math.max(leftY + 10, doc.y + 10, 140);
  doc.moveTo(50, headerEndY).lineTo(545, headerEndY).strokeColor('#dddddd').stroke();

  // --- Bill To ---
  const billY = headerEndY + 12;
  doc.fillColor('#333333').fontSize(11).text('Bill To / Shipping Address', 50, billY);
  doc.fillColor('#555555').fontSize(10);
  doc.text(data.customer.name, 50, doc.y + 2, { width: 300 });
  if (data.customer.email) doc.text(data.customer.email, { width: 300 });
  if (data.customer.phone) doc.text(`Ph: ${data.customer.phone}`, { width: 300 });
  if (data.customer.addressLine) doc.text(data.customer.addressLine, { width: 300 });

  // --- Items table ---
  let y = doc.y + 20;
  doc.fillColor('#333333').fontSize(10);
  doc.text('Item', 50, y);
  doc.text('Qty', 330, y, { width: 40, align: 'right' });
  doc.text('Price', 380, y, { width: 70, align: 'right' });
  doc.text('Amount', 460, y, { width: 85, align: 'right' });
  y += 15;
  doc.moveTo(50, y).lineTo(545, y).strokeColor('#dddddd').stroke();
  y += 8;

  doc.fillColor('#555555');
  for (const it of data.items) {
    if (y > 720) { doc.addPage(); y = 50; }
    const rowH = doc.heightOfString(it.name, { width: 270 });
    doc.text(it.name, 50, y, { width: 270 });
    doc.text(String(it.quantity), 330, y, { width: 40, align: 'right' });
    doc.text(money(it.price), 380, y, { width: 70, align: 'right' });
    doc.text(money(it.subtotal), 460, y, { width: 85, align: 'right' });
    y += Math.max(rowH, 14) + 6;
  }

  // --- Totals ---
  y += 6;
  doc.moveTo(330, y).lineTo(545, y).strokeColor('#dddddd').stroke();
  y += 10;
  const totalRow = (label, val, bold) => {
    doc.fillColor(bold ? '#111111' : '#555555').fontSize(bold ? 12 : 10);
    doc.text(label, 330, y, { width: 120, align: 'right' });
    doc.text(val, 455, y, { width: 90, align: 'right' });
    y += bold ? 22 : 16;
  };
  totalRow('Subtotal', money(data.pricing.subtotal));
  if (data.pricing.discount) totalRow('Discount', `- ${money(data.pricing.discount)}`);
  totalRow('Delivery', data.pricing.shipping ? money(data.pricing.shipping) : (data.pricing.shippingWaived ? 'Waived (Free)' : 'Free'));
  if (data.pricing.tax) totalRow('Tax', money(data.pricing.tax));
  totalRow('Total', money(data.pricing.total), true);

  doc.fillColor('#999999').fontSize(9).text('Thank you for shopping with AgriCola. Sourced sustainably from Indian farms.', 50, 780, {
    width: 495,
    align: 'center',
  });

  doc.end();
}

/**
 * Stream a PDF invoice for an order to a writable stream (e.g. the HTTP response).
 */
function streamInvoice(order, out) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  doc.pipe(out);
  renderInvoiceDoc(order, doc);
}

/**
 * Generate PDF invoice buffer in-memory for emailing or attachments.
 * @param {Object} order 
 * @returns {Promise<Buffer>}
 */
function generateInvoiceBuffer(order) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    renderInvoiceDoc(order, doc);
  });
}

// ---- 4×6 inch (288×432 pt) thermal formats ---------------------------------

/** Compact 4×6 invoice / packing slip for thermal printers. Uses identical buildInvoiceData. */
function streamInvoice4x6(order, out) {
  const doc = new PDFDocument({ size: [288, 432], margin: 16 });
  doc.pipe(out);
  const data = buildInvoiceData(order);

  doc.fillColor('#84b817').fontSize(15).text('AgriCola', 16, 16);
  doc.fillColor('#333333').fontSize(8).text('Tax Invoice', 16, 16, { width: 256, align: 'right' });
  doc.fillColor('#111111').fontSize(9).text(`Order: ${data.orderId}`, 16, 36);
  doc.fillColor('#666666').fontSize(7.5).text(`${data.formattedDate}  ·  ${data.paymentMethod} (${data.paymentStatus})`);
  if (data.seller.facilityName) {
    doc.fillColor('#444444').fontSize(7.5).text(`Dispatch Facility: ${data.seller.facilityName}`);
  }
  if (data.seller.gstin) {
    doc.fillColor('#666666').fontSize(7).text(`GSTIN: ${data.seller.gstin}`);
  }

  doc.moveDown(0.3).fillColor('#111111').fontSize(8.5).text('Bill To');
  doc.fillColor('#555555').fontSize(7.5).text(data.customer.name, { width: 256 });
  if (data.customer.email) doc.text(data.customer.email, { width: 256 });
  if (data.customer.phone) doc.text(`Ph: ${data.customer.phone}`, { width: 256 });
  if (data.customer.addressLine) doc.text(data.customer.addressLine, { width: 256 });

  let y = doc.y + 6;
  doc.fillColor('#111111').fontSize(8);
  doc.text('Item', 16, y); doc.text('Qty', 176, y, { width: 32, align: 'right' }); doc.text('Amt', 216, y, { width: 56, align: 'right' });
  y += 11; doc.moveTo(16, y).lineTo(272, y).strokeColor('#cccccc').stroke(); y += 4;
  doc.fillColor('#555555');
  for (const it of data.items) {
    if (y > 380) { doc.addPage(); y = 16; }
    const h = doc.heightOfString(it.name, { width: 154 });
    doc.text(it.name, 16, y, { width: 154 });
    doc.text(String(it.quantity), 176, y, { width: 32, align: 'right' });
    doc.text(money(it.subtotal), 216, y, { width: 56, align: 'right' });
    y += Math.max(h, 10) + 3;
  }
  y += 3; doc.moveTo(150, y).lineTo(272, y).strokeColor('#cccccc').stroke(); y += 5;
  const row = (l, v, b) => {
    doc.fillColor(b ? '#111111' : '#555555').fontSize(b ? 9.5 : 7.5);
    doc.text(l, 150, y, { width: 66, align: 'right' });
    doc.text(v, 220, y, { width: 52, align: 'right' });
    y += b ? 13 : 10;
  };
  row('Subtotal', money(data.pricing.subtotal));
  if (data.pricing.discount) row('Discount', `- ${money(data.pricing.discount)}`);
  row('Delivery', data.pricing.shipping ? money(data.pricing.shipping) : (data.pricing.shippingWaived ? 'Waived (Free)' : 'Free'));
  if (data.pricing.tax) row('Tax', money(data.pricing.tax));
  row('Total', money(data.pricing.total), true);
  doc.end();
}

/** 4×6 shipping / address label for thermal printers. Uses identical buildInvoiceData. */
function streamShippingLabel(order, out) {
  const doc = new PDFDocument({ size: [288, 432], margin: 14 });
  doc.pipe(out);
  const data = buildInvoiceData(order);

  doc.lineWidth(1).rect(6, 6, 276, 420).strokeColor('#000000').stroke();

  doc.fillColor('#000000').fontSize(13).text('AgriCola', 14, 14);
  doc.fontSize(10).text(data.isCOD ? 'COD' : 'PREPAID', 14, 16, { width: 260, align: 'right' });
  doc.moveTo(14, 34).lineTo(274, 34).stroke();

  doc.fillColor('#555555').fontSize(7).text('DISPATCH FROM (ORIGIN)', 14, 38);
  doc.fillColor('#000000').fontSize(8.5).text(data.seller.name, 14, 47, { width: 260 });
  if (data.seller.address) doc.fillColor('#333333').fontSize(7).text(data.seller.address, 14, doc.y, { width: 260 });
  if (data.seller.contact) doc.fillColor('#555555').fontSize(7).text(`Ph: ${data.seller.contact}`, 14, doc.y);

  let y = doc.y + 6;
  doc.moveTo(14, y).lineTo(274, y).strokeColor('#cccccc').stroke(); y += 8;

  doc.fillColor('#555555').fontSize(7.5).text('DELIVER TO (DESTINATION)', 14, y); y += 12;
  doc.fillColor('#000000').fontSize(13).text(data.customer.name, 14, y, { width: 260 }); y = doc.y + 2;
  const addrStr = [data.customer.street, data.customer.city].filter(Boolean).join(', ');
  if (addrStr) { doc.fontSize(9.5).text(addrStr, 14, y, { width: 260 }); y = doc.y; }
  doc.fontSize(10.5).text(`${data.customer.state} - ${data.customer.pincode}`, 14, y, { width: 260 }); y = doc.y + 2;
  doc.fontSize(10.5).text(`Ph: ${data.customer.phone || '-'}`, 14, y); y = doc.y + 8;

  doc.lineWidth(1).moveTo(14, y).lineTo(274, y).strokeColor('#000000').stroke(); y += 8;

  doc.fillColor('#000000').fontSize(9).text(`Order ID: ${data.orderId}`, 14, y); y = doc.y + 4;
  if (data.shipping.trackingNumber) {
    doc.fontSize(14).text(`AWB: ${data.shipping.trackingNumber}`, 14, y, { width: 260 }); y = doc.y + 2;
    doc.fillColor('#555555').fontSize(8).text(`Courier: ${data.shipping.carrier || '-'}`, 14, y);
  } else {
    doc.fillColor('#aa0000').fontSize(9.5).text('AWB: Pending Warehouse Assignment', 14, y);
  }
  if (data.isCOD) doc.fillColor('#000000').fontSize(12).text(`COLLECT COD: ${money(data.pricing.total)}`, 14, doc.y + 8, { width: 260 });

  doc.end();
}

module.exports = {
  buildInvoiceData,
  renderInvoiceDoc,
  streamInvoice,
  streamInvoice4x6,
  streamShippingLabel,
  generateInvoiceBuffer
};
