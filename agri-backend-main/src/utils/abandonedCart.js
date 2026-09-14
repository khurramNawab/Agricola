// Abandoned cart messaging engine for Email (Zoho SMTP), SMS (Fast2SMS), and WhatsApp.
const emailUtils = require('./email');
const { sendOtpSms, toLocalNumber } = require('./sms');

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://www.agricola.co.in';

const TEMPLATES = {
  reminder: {
    id: 'reminder',
    name: 'Gentle Cart Reminder',
    subject: 'Did you leave something behind in your cart?',
    body: 'Hi {name}, we noticed you left {product} in your AgriCola cart. Complete your order now to enjoy farm-fresh goodness delivered right to your door!'
  },
  discount: {
    id: 'discount',
    name: 'Special Discount Offer',
    subject: 'A special discount for the items in your cart! 🎁',
    body: 'Hi {name}, complete your order today and use promo code {coupon} to get an exclusive discount on your cart of ₹{cart_total}! Claim it here: {checkout_url}'
  },
  stock_alert: {
    id: 'stock_alert',
    name: 'High Demand Stock Alert',
    subject: 'Hurry! Items in your cart are selling fast ⚡',
    body: 'Hi {name}, high demand on {product}! Grab your cart worth ₹{cart_total} before stock runs out. Finish checkout now: {checkout_url}'
  }
};

/**
 * Format a personalized text template with customer & cart placeholders.
 */
const formatTemplate = (templateString, { name, product, cartTotal, coupon, checkoutUrl }) => {
  return String(templateString || '')
    .replace(/{name}/gi, name || 'there')
    .replace(/{product}/gi, product || 'your selected items')
    .replace(/{cart_total}/gi, String(cartTotal || 0))
    .replace(/{coupon}/gi, coupon || 'AGRI10')
    .replace(/{checkout_url}/gi, checkoutUrl || `${FRONTEND_URL}/cart`);
};

/**
 * Build rich HTML email for abandoned cart notification.
 */
const buildAbandonedCartEmail = ({ name, items = [], subtotal = 0, couponCode, customMessage, checkoutUrl }) => {
  const logoUrl = process.env.EMAIL_LOGO_URL || 'https://www.agricola.co.in/agricola_logo.png';
  const cartUrl = checkoutUrl || `${FRONTEND_URL}/cart`;
  const customerName = name || 'Valued Customer';

  const itemRows = (items || [])
    .map(
      (item) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;">
          <strong style="color:#111827;font-size:14px;">${item.name || item.title || 'Product'}</strong>
          ${item.weight ? `<span style="color:#6b7280;font-size:12px;"> · ${item.weight}</span>` : ''}
          <div style="color:#4b5563;font-size:12px;">Qty: ${item.quantity || item.qty || 1}</div>
        </td>
        <td style="padding:10px 0;text-align:right;border-bottom:1px solid #f3f4f6;font-weight:600;color:#111827;font-size:14px;">
          ₹${item.subtotal || item.lineTotal || item.price || 0}
        </td>
      </tr>`
    )
    .join('');

  const couponSection = couponCode
    ? `
    <div style="background:#f7fee7;border:1px dashed #84b817;border-radius:12px;padding:16px;margin:20px 0;text-align:center;">
      <p style="margin:0 0 6px;color:#3f6212;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Special Offer Just For You</p>
      <div style="font-family:monospace;font-size:22px;font-weight:bold;color:#166534;background:#fff;display:inline-block;padding:6px 18px;border-radius:8px;border:1px solid #d9f99d;">
        ${couponCode}
      </div>
      <p style="margin:6px 0 0;color:#4d7c0f;font-size:12px;">Apply this coupon at checkout to unlock extra savings!</p>
    </div>`
    : '';

  const html = `
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8" /></head>
  <body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:580px;margin:30px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.05);border:1px solid #e5e7eb;">
      
      <!-- Brand Header -->
      <div style="background:#111827;padding:24px;text-align:center;">
        <img src="${logoUrl}" alt="AgriCola" width="48" height="48" style="border-radius:50%;display:inline-block;margin-bottom:8px;" />
        <h1 style="color:#ffffff;font-size:20px;margin:0;font-weight:700;letter-spacing:-0.5px;">AgriCola</h1>
        <p style="color:#9ca3af;font-size:12px;margin:4px 0 0;">Pure, Natural & Sustainably Sourced</p>
      </div>

      <!-- Main Body -->
      <div style="padding:32px 28px;">
        <h2 style="color:#111827;font-size:18px;margin:0 0 12px;font-weight:700;">Hi ${customerName},</h2>
        <p style="color:#4b5563;font-size:14px;line-height:1.6;margin:0 0 20px;">
          ${customMessage || "We noticed you left some pure, natural items in your shopping bag. They're still safely reserved for you!"}
        </p>

        <!-- Cart items summary -->
        <div style="background:#f9fafb;border-radius:12px;padding:16px 20px;margin-bottom:20px;">
          <h3 style="color:#374151;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 12px;font-weight:600;">Items in your cart</h3>
          <table style="width:100%;border-collapse:collapse;">
            ${itemRows}
            <tr>
              <td style="padding-top:12px;font-weight:700;color:#111827;font-size:15px;">Cart Total</td>
              <td style="padding-top:12px;text-align:right;font-weight:700;color:#111827;font-size:15px;">₹${subtotal}</td>
            </tr>
          </table>
        </div>

        ${couponSection}

        <!-- CTA Button -->
        <div style="text-align:center;margin:28px 0 20px;">
          <a href="${cartUrl}" style="display:inline-block;background:#84b817;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 32px;border-radius:10px;box-shadow:0 4px 12px rgba(132,184,23,0.35);">
            Complete Your Order &rarr;
          </a>
        </div>

        <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0;">
          Need help with your order? Reply directly to this email or reach us on WhatsApp.
        </p>
      </div>

      <!-- Footer -->
      <div style="background:#f3f4f6;padding:16px;text-align:center;border-top:1px solid #e5e7eb;">
        <p style="color:#6b7280;font-size:11px;margin:0;">&copy; ${new Date().getFullYear()} AgriCola. All rights reserved.</p>
      </div>

    </div>
  </body>
  </html>`;

  const text = `Hi ${customerName},\n\nYou left items worth ₹${subtotal} in your AgriCola cart.\n${customMessage || ''}\n\nComplete your order at: ${cartUrl}\n${couponCode ? `Use coupon code: ${couponCode}\n` : ''}`;

  return { html, text };
};

/**
 * Dispatch abandoned cart email.
 */
const sendAbandonedEmail = async ({ to, subject, name, items, subtotal, couponCode, customMessage, checkoutUrl }) => {
  const { html, text } = buildAbandonedCartEmail({ name, items, subtotal, couponCode, customMessage, checkoutUrl });
  const finalSubject = subject || (couponCode ? `Special offer on items in your cart! 🎁` : `Your AgriCola cart is waiting for you`);

  return emailUtils.sendMail({
    to,
    subject: finalSubject,
    html,
    text
  });
};

/**
 * Generate standard WhatsApp web link with pre-filled message.
 */
const buildWhatsAppLink = (phone, message) => {
  const cleanPhone = String(phone || '').replace(/\D/g, '');
  const e164 = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone.slice(-10)}`;
  return `https://wa.me/${e164}?text=${encodeURIComponent(message)}`;
};

module.exports = {
  TEMPLATES,
  formatTemplate,
  buildAbandonedCartEmail,
  sendAbandonedEmail,
  buildWhatsAppLink
};
