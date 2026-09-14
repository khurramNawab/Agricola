// PDF invoice generation via pdfkit. Streams straight to the HTTP response.
// Uses "Rs." rather than the ₹ glyph, which the built-in Helvetica font can't render.
const PDFDocument = require('pdfkit');

const money = (n) => `Rs. ${Number(n || 0).toLocaleString('en-IN')}`;
const fmtDate = (d) =>
  new Date(d || Date.now()).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

/**
 * Stream a PDF invoice for an order to a writable stream (e.g. the HTTP response).
 * The order should have `user` and `items` populated.
 */
/**
 * Stream a PDF invoice for an order to a writable stream (e.g. the HTTP response).
 * The order should have `user`, `warehouse`, and `items` populated.
 */
function streamInvoice(order, out) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  doc.pipe(out);

  const defaultSellerName = process.env.SELLER_NAME || process.env.EKART_SELLER_NAME || 'AgriCola';
  const defaultSellerAddr = process.env.SELLER_ADDRESS || process.env.EKART_SELLER_ADDRESS || '';
  const sellerGst = process.env.SELLER_GST_TIN || process.env.EKART_SELLER_GST_TIN || '';

  const wh = order.warehouse && typeof order.warehouse === 'object' ? order.warehouse : null;
  const sellerName = wh ? `${defaultSellerName} (${wh.name || wh.code})` : defaultSellerName;
  const sellerAddr = wh && wh.address
    ? [wh.address.street, wh.address.city, wh.address.state, wh.address.pincode].filter(Boolean).join(', ')
    : defaultSellerAddr;

  const addr = order.shippingAddress || {};
  const p = order.pricing || {};
  const user = order.user && typeof order.user === 'object' ? order.user : {};

  // --- Header ---
  doc.fillColor('#84b817').fontSize(24).text('AgriCola', 50, 50);
  doc.fillColor('#333333').fontSize(14).text('Tax Invoice', 300, 55, { width: 195, align: 'right' });

  doc.fillColor('#666666').fontSize(9);
  let leftY = 82;
  doc.text(`Seller / Dispatcher: ${sellerName}`, 50, leftY, { width: 240 });
  leftY = doc.y;
  if (sellerAddr) { doc.text(`Origin: ${sellerAddr}`, 50, leftY, { width: 240 }); leftY = doc.y; }
  if (wh && wh.spocPhone) { doc.text(`Contact: ${wh.spocName || 'Manager'} (${wh.spocPhone})`, 50, leftY, { width: 240 }); leftY = doc.y; }
  if (sellerGst) doc.text(`GSTIN: ${sellerGst}`, 50, leftY, { width: 240 });

  doc.fillColor('#333333').fontSize(10);
  doc.text(`Invoice No: ${order.orderId}`, 300, 82, { width: 195, align: 'right' });
  doc.text(`Date: ${fmtDate(order.createdAt)}`, 300, doc.y, { width: 195, align: 'right' });
  doc.text(`Payment: ${(order.paymentMethod || '-').toUpperCase()} (${(order.paymentStatus || '-').toUpperCase()})`, 300, doc.y, { width: 195, align: 'right' });

  const headerEndY = Math.max(leftY + 10, doc.y + 10, 140);
  doc.moveTo(50, headerEndY).lineTo(545, headerEndY).strokeColor('#dddddd').stroke();

  // --- Bill To ---
  const billY = headerEndY + 12;
  doc.fillColor('#333333').fontSize(11).text('Bill To / Shipping Address', 50, billY);
  doc.fillColor('#555555').fontSize(10);
  const custName = addr.name || user.name || 'Customer';
  doc.text(custName, 50, doc.y + 2, { width: 300 });
  const custEmail = order.email || user.email;
  if (custEmail) doc.text(custEmail, { width: 300 });
  const custPhone = addr.phone || user.phone;
  if (custPhone) doc.text(`Ph: ${custPhone}`, { width: 300 });
  const addrLine = [addr.street, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ');
  if (addrLine) doc.text(addrLine, { width: 300 });

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
  for (const it of order.items || []) {
    if (y > 720) { doc.addPage(); y = 50; }
    const name = `${it.name}${it.weight ? ` (${it.weight})` : ''}`;
    const rowH = doc.heightOfString(name, { width: 270 });
    doc.text(name, 50, y, { width: 270 });
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
  totalRow('Subtotal', money(p.subtotal));
  if (p.discount) totalRow('Discount', `- ${money(p.discount)}`);
  totalRow('Delivery', p.shipping ? money(p.shipping) : 'Free');
  if (p.tax) totalRow('Tax', money(p.tax));
  totalRow('Total', money(p.total), true);

  doc.fillColor('#999999').fontSize(9).text('Thank you for shopping with AgriCola.', 50, 780, {
    width: 495,
    align: 'center',
  });

  doc.end();
}

// ---- 4×6 inch (288×432 pt) thermal formats ---------------------------------

/** Compact 4×6 invoice / packing slip for thermal printers. */
function streamInvoice4x6(order, out) {
  const doc = new PDFDocument({ size: [288, 432], margin: 16 });
  doc.pipe(out);
  const p = order.pricing || {};
  const a = order.shippingAddress || {};
  const wh = order.warehouse && typeof order.warehouse === 'object' ? order.warehouse : null;

  doc.fillColor('#84b817').fontSize(15).text('AgriCola', 16, 16);
  doc.fillColor('#333333').fontSize(8).text('Tax Invoice', 16, 16, { width: 256, align: 'right' });
  doc.fillColor('#111111').fontSize(9).text(`Order: ${order.orderId}`, 16, 36);
  doc.fillColor('#666666').fontSize(7.5).text(`${fmtDate(order.createdAt)}  ·  ${(order.paymentMethod || '-').toUpperCase()} (${(order.paymentStatus || '-').toUpperCase()})`);
  if (wh) {
    doc.fillColor('#444444').fontSize(7.5).text(`Dispatch Facility: ${wh.name || wh.code}`);
  }

  doc.moveDown(0.4).fillColor('#111111').fontSize(8.5).text('Bill To');
  doc.fillColor('#555555').fontSize(7.5).text(a.name || '-', { width: 256 });
  if (order.email) doc.text(order.email, { width: 256 });
  if (a.phone) doc.text(`Ph: ${a.phone}`, { width: 256 });
  const line = [a.street, a.city, a.state, a.pincode].filter(Boolean).join(', ');
  if (line) doc.text(line, { width: 256 });

  let y = doc.y + 6;
  doc.fillColor('#111111').fontSize(8);
  doc.text('Item', 16, y); doc.text('Qty', 176, y, { width: 32, align: 'right' }); doc.text('Amt', 216, y, { width: 56, align: 'right' });
  y += 11; doc.moveTo(16, y).lineTo(272, y).strokeColor('#cccccc').stroke(); y += 4;
  doc.fillColor('#555555');
  for (const it of order.items || []) {
    if (y > 380) { doc.addPage(); y = 16; }
    const nm = `${it.name}${it.weight ? ` (${it.weight})` : ''}`;
    const h = doc.heightOfString(nm, { width: 154 });
    doc.text(nm, 16, y, { width: 154 });
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
  row('Subtotal', money(p.subtotal));
  if (p.discount) row('Discount', `- ${money(p.discount)}`);
  row('Delivery', p.shipping ? money(p.shipping) : 'Free');
  row('Total', money(p.total), true);
  doc.end();
}

/** 4×6 shipping / address label for thermal printers. */
function streamShippingLabel(order, out) {
  const doc = new PDFDocument({ size: [288, 432], margin: 14 });
  doc.pipe(out);
  const a = order.shippingAddress || {};
  const s = order.shipping || {};
  const isCOD = String(order.paymentMethod).toLowerCase() === 'cod';
  const wh = order.warehouse && typeof order.warehouse === 'object' ? order.warehouse : null;

  const defaultSellerName = process.env.SELLER_NAME || process.env.EKART_SELLER_NAME || 'AgriCola';
  const defaultSellerAddr = process.env.SELLER_ADDRESS || process.env.EKART_SELLER_ADDRESS || '';

  const fromName = wh ? `AgriCola (${wh.name || wh.code})` : defaultSellerName;
  const fromAddr = wh && wh.address
    ? [wh.address.street, wh.address.city, wh.address.state, wh.address.pincode].filter(Boolean).join(', ')
    : defaultSellerAddr;

  doc.lineWidth(1).rect(6, 6, 276, 420).strokeColor('#000000').stroke();

  doc.fillColor('#000000').fontSize(13).text('AgriCola', 14, 14);
  doc.fontSize(10).text(isCOD ? 'COD' : 'PREPAID', 14, 16, { width: 260, align: 'right' });
  doc.moveTo(14, 34).lineTo(274, 34).stroke();

  doc.fillColor('#555555').fontSize(7).text('DISPATCH FROM (ORIGIN)', 14, 38);
  doc.fillColor('#000000').fontSize(8.5).text(fromName, 14, 47, { width: 260 });
  if (fromAddr) doc.fillColor('#333333').fontSize(7).text(fromAddr, 14, doc.y, { width: 260 });
  if (wh && wh.spocPhone) doc.fillColor('#555555').fontSize(7).text(`Ph: ${wh.spocPhone}`, 14, doc.y);

  let y = doc.y + 6;
  doc.moveTo(14, y).lineTo(274, y).strokeColor('#cccccc').stroke(); y += 8;

  doc.fillColor('#555555').fontSize(7.5).text('DELIVER TO (DESTINATION)', 14, y); y += 12;
  doc.fillColor('#000000').fontSize(13).text(a.name || '-', 14, y, { width: 260 }); y = doc.y + 2;
  const addrStr = [a.street, a.city].filter(Boolean).join(', ');
  if (addrStr) { doc.fontSize(9.5).text(addrStr, 14, y, { width: 260 }); y = doc.y; }
  doc.fontSize(10.5).text(`${a.state || ''} - ${a.pincode || ''}`, 14, y, { width: 260 }); y = doc.y + 2;
  doc.fontSize(10.5).text(`Ph: ${a.phone || '-'}`, 14, y); y = doc.y + 8;

  doc.lineWidth(1).moveTo(14, y).lineTo(274, y).strokeColor('#000000').stroke(); y += 8;

  doc.fillColor('#000000').fontSize(9).text(`Order ID: ${order.orderId}`, 14, y); y = doc.y + 4;
  if (s.trackingNumber) {
    doc.fontSize(14).text(`AWB: ${s.trackingNumber}`, 14, y, { width: 260 }); y = doc.y + 2;
    doc.fillColor('#555555').fontSize(8).text(`Courier: ${s.courierName || s.carrier || '-'}`, 14, y);
  } else {
    doc.fillColor('#aa0000').fontSize(9.5).text('AWB: Pending Warehouse Assignment', 14, y);
  }
  if (isCOD) doc.fillColor('#000000').fontSize(12).text(`COLLECT COD: ${money(order.pricing?.total)}`, 14, doc.y + 8, { width: 260 });

  doc.end();
}

module.exports = { streamInvoice, streamInvoice4x6, streamShippingLabel };
