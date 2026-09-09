// Transactional email via SMTP (Zoho) using nodemailer. Sends the customer an
// order confirmation AND notifies the store of every new order. Best-effort:
// if SMTP isn't configured (or a send fails) we log and move on so order/payment
// flows are never broken by email problems.
const nodemailer = require('nodemailer');

const isConfigured = () => {
  const { EMAIL_HOST, EMAIL_USER, EMAIL_PASS } = process.env;
  return !!(
    EMAIL_HOST && EMAIL_USER && EMAIL_PASS &&
    !EMAIL_USER.startsWith('your-') && !EMAIL_PASS.startsWith('your-')
  );
};

let transporter = null;
const getTransporter = () => {
  if (!transporter) {
    const port = Number(process.env.EMAIL_PORT) || 587;
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,           // e.g. smtp.zoho.in
      port,
      secure: port === 465,                   // 465 = SSL, 587 = STARTTLS
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
  }
  return transporter;
};

const fromAddress = () => process.env.EMAIL_FROM || `AgriCola <${process.env.EMAIL_USER}>`;

/** Send one email. Skips (logs) when unconfigured. Throws only on a real send error. */
const sendMail = async ({ to, subject, html, text, replyTo }) => {
  if (!isConfigured()) {
    console.warn(`[email] SMTP not configured — skipping "${subject}" to ${to}`);
    return { skipped: true };
  }
  return getTransporter().sendMail({ from: fromAddress(), to, subject, html, text, replyTo });
};

const rupees = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const itemRows = (order) =>
  (order.items || [])
    .map(
      (i) => `<tr>
        <td style="padding:8px 0;color:#374151;">${i.name}${i.weight ? ` · ${i.weight}` : ''} × ${i.quantity}</td>
        <td style="padding:8px 0;text-align:right;color:#111827;">${rupees(i.subtotal)}</td>
      </tr>`
    )
    .join('');

const totalsRows = (p) => `
  <tr><td style="padding-top:12px;border-top:1px solid #e5e7eb;color:#6b7280;">Subtotal</td><td style="padding-top:12px;border-top:1px solid #e5e7eb;text-align:right;">${rupees(p.subtotal)}</td></tr>
  ${p.discount ? `<tr><td style="color:#6b7280;">Discount</td><td style="text-align:right;">- ${rupees(p.discount)}</td></tr>` : ''}
  <tr><td style="color:#6b7280;">Delivery</td><td style="text-align:right;">${p.shipping ? rupees(p.shipping) : 'Free'}</td></tr>
  <tr><td style="font-weight:bold;padding-top:8px;">Total</td><td style="font-weight:bold;text-align:right;padding-top:8px;">${rupees(p.total)}</td></tr>`;

/** Customer-facing order confirmation. */
const buildOrderConfirmation = (order) => {
  const trackUrl = `${String(process.env.FRONTEND_URL || '').replace(/\/$/, '')}/track`;
  const logoUrl = process.env.EMAIL_LOGO_URL || 'https://www.agricola.co.in/agricola_logo.png';
  const p = order.pricing || {};
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#111827;">
    <img src="${logoUrl}" alt="AgriCola" width="56" height="56" style="display:block;border:0;border-radius:50%;margin:0 0 12px;" />
    <p style="color:#374151;">Thanks for your order! We've received it and it's being processed.</p>
    <p style="font-size:15px;">Order ID: <strong>${order.orderId}</strong></p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">${itemRows(order)}${totalsRows(p)}</table>
    <a href="${trackUrl}" style="display:inline-block;background:#84b817;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">Track your order</a>
    <p style="color:#6b7280;font-size:13px;margin-top:12px;">On the tracking page, enter your Order ID (<strong>${order.orderId}</strong>) and the mobile number on your order.</p>
  </div>`;
  const text = `Thanks for your order!\nOrder ID: ${order.orderId}\nTotal: ${rupees(p.total)}\nTrack it at ${trackUrl}.`;
  return { subject: `Your AgriCola order ${order.orderId} is confirmed`, html, text };
};

/** Store-facing new-order notification (to AgriCola). */
const buildOrderNotification = (order) => {
  const user = order.user && typeof order.user === 'object' ? order.user : {};
  const a = order.shippingAddress || {};
  const p = order.pricing || {};
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#111827;">
    <h2 style="margin:0 0 4px;">New order · ${order.orderId}</h2>
    <p style="color:#6b7280;margin:0 0 16px;">${order.paymentMethod || ''} · ${order.paymentStatus || ''}</p>
    <p style="margin:0 0 4px;"><strong>Customer:</strong> ${a.name || user.name || '-'} · ${order.email || user.email || '-'} · ${a.phone || user.phone || '-'}</p>
    <p style="margin:0 0 16px;"><strong>Ship to:</strong> ${[a.street, a.city, a.state, a.pincode].filter(Boolean).join(', ')}</p>
    <table style="width:100%;border-collapse:collapse;margin:0 0 16px;font-size:14px;">${itemRows(order)}${totalsRows(p)}</table>
  </div>`;
  const text = `New order ${order.orderId} — ${rupees(p.total)} — ${a.name || user.name || ''} (${order.email || user.email || ''})`;
  return { subject: `New order ${order.orderId} · ${rupees(p.total)}`, html, text };
};

/**
 * Send the order-confirmation email to the customer AND a new-order notification
 * to the store. Deduped via order.notifications.orderConfirmationEmailSentAt so a
 * Razorpay order (confirmed by both the client verify and the webhook) sends once.
 * Best-effort; never throws.
 */
const sendOrderConfirmation = async (order) => {
  try {
    if (order.notifications?.orderConfirmationEmailSentAt) return; // already sent
    if (!isConfigured()) return;

    await order.populate('user', 'email name phone');
    const customerTo = order.email || order.user?.email;
    if (customerTo) {
      await sendMail({ to: customerTo, ...buildOrderConfirmation(order) });
    } else {
      console.warn(`[email] order ${order.orderId}: no customer email — confirmation skipped`);
    }

    // Notify the store of the new order.
    const storeTo = process.env.STORE_ORDER_EMAIL || process.env.NOTIFY_FALLBACK_EMAIL || process.env.EMAIL_USER;
    if (storeTo) {
      await sendMail({ to: storeTo, replyTo: customerTo || undefined, ...buildOrderNotification(order) });
    }

    if (!order.notifications) order.notifications = {};
    order.notifications.orderConfirmationEmailSentAt = new Date();
    await order.save();
  } catch (e) {
    console.error(`[email] order emails failed for ${order.orderId}:`, e.message);
  }
};

module.exports = { isConfigured, sendMail, buildOrderConfirmation, buildOrderNotification, sendOrderConfirmation };
