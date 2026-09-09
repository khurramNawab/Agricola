/**
 * Register AgriCola's shipment webhook with Ekart (GoSwift/Elite) so Ekart pushes
 * track_updated / shipment_created / shipment_recreated events to our receiver
 * at POST /api/v1/shipping/webhook.
 *
 * Idempotent: lists existing webhooks first and skips if our URL is already
 * registered. Reads config from .env:
 *   EKART_WEBHOOK_URL     public URL Ekart should POST to
 *   EKART_WEBHOOK_SECRET  6-30 char shared secret (also used by our receiver to verify HMAC)
 *   EKART_* creds         (or EKART_MOCK=true to dry-run against the in-memory mock)
 *
 * Usage: npm run ekart:webhook   (or: node scripts/registerEkartWebhook.js)
 */
require('dotenv').config();
const ekart = require('../src/utils/ekart');

(async () => {
  const url = process.env.EKART_WEBHOOK_URL;
  const secret = process.env.EKART_WEBHOOK_SECRET;

  if (!url || url.startsWith('your-')) {
    console.error('✖ EKART_WEBHOOK_URL is not set in .env (e.g. https://api.agricola.co.in/api/v1/shipping/webhook).');
    process.exit(1);
  }
  if (!secret || secret.startsWith('your-') || secret.length < 6 || secret.length > 30) {
    console.error('✖ EKART_WEBHOOK_SECRET must be a real 6-30 character value (it is shared with Ekart and used to verify webhook signatures).');
    process.exit(1);
  }
  if (!ekart.isConfigured()) {
    console.error('✖ Ekart is not configured. Set EKART_CLIENT_ID/USERNAME/PASSWORD, or EKART_MOCK=true to dry-run.');
    process.exit(1);
  }

  console.log(`Mode: ${ekart.isMock() ? 'MOCK (no network)' : 'LIVE'}`);
  console.log(`Target URL: ${url}`);
  console.log(`Topics: ${ekart.WEBHOOK_TOPICS.join(', ')}\n`);

  const existing = await ekart.listWebhooks();
  const already = existing.find((w) => w.url === url);
  if (already) {
    console.log(`✓ A webhook for this URL is already registered (id: ${already.id}).`);
    console.log(`  Topics: ${(already.topics || []).join(', ') || '(none reported)'}`);
    console.log('  Nothing to do. Edit it in the Ekart dashboard if topics need to change.');
    process.exit(0);
  }

  const created = await ekart.registerWebhook({ url, secret });
  console.log('✅ Registered Ekart webhook:');
  console.log(`   id:     ${created.id}`);
  console.log(`   url:    ${created.url || url}`);
  console.log(`   topics: ${(created.topics || ekart.WEBHOOK_TOPICS).join(', ')}`);
  console.log(`   active: ${created.active !== false}`);
  process.exit(0);
})().catch((err) => {
  const detail = err.response?.data || err.message;
  console.error('\n✖ Failed to register Ekart webhook:', typeof detail === 'object' ? JSON.stringify(detail) : detail);
  process.exit(1);
});
