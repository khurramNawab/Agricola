/**
 * One-shot data migration: rename the legacy product field
 *   `brewingInstructions`  ->  `usageInstructions`
 * introduced when AgriCola was generalized from a tea-only store to a generic
 * agriculture store. (The admin API field `aboutTea` was only a request/response
 * alias for the model's `about` field — it was never stored — so it needs no
 * migration.)
 *
 * Safe + idempotent:
 *   - scoped to documents that actually carry the legacy field,
 *   - never clobbers an existing `usageInstructions` value,
 *   - dry-run by default; pass `--apply` to perform the writes.
 *
 * Usage:
 *   node scripts/migrateUsageInstructions.js            # dry run (read-only)
 *   node scripts/migrateUsageInstructions.js --apply    # perform migration
 */
require('dotenv').config();
const mongoose = require('mongoose');

const APPLY = process.argv.includes('--apply');

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri || uri.startsWith('your-')) {
    console.error('✖ MONGODB_URI is not configured in .env — aborting.');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log(`Connected → host: ${mongoose.connection.host}  db: ${mongoose.connection.name}`);
  console.log(`Mode: ${APPLY ? 'APPLY (writing)' : 'DRY RUN (read-only)'}\n`);

  const col = mongoose.connection.collection('products');

  const total = await col.countDocuments();
  const legacyOnly = await col.countDocuments({
    brewingInstructions: { $exists: true },
    usageInstructions: { $exists: false },
  });
  const both = await col.countDocuments({
    brewingInstructions: { $exists: true },
    usageInstructions: { $exists: true },
  });
  const alreadyMigrated = await col.countDocuments({ usageInstructions: { $exists: true } });

  console.log(`Products total: ............................. ${total}`);
  console.log(`Has 'usageInstructions' already: ............ ${alreadyMigrated}`);
  console.log(`Legacy 'brewingInstructions' to rename: ..... ${legacyOnly}`);
  console.log(`Has BOTH (legacy will be dropped): .......... ${both}`);

  const toChange = legacyOnly + both;
  if (toChange === 0) {
    console.log('\n✅ Nothing to migrate — database is already up to date.');
    await mongoose.disconnect();
    process.exit(0);
  }

  if (!APPLY) {
    console.log(`\nDRY RUN: ${legacyOnly} document(s) would be renamed and ${both} would have the stale legacy field removed.`);
    console.log('Re-run with --apply to perform the migration.');
    await mongoose.disconnect();
    process.exit(0);
  }

  // 1) Rename where only the legacy field exists.
  const renamed = await col.updateMany(
    { brewingInstructions: { $exists: true }, usageInstructions: { $exists: false } },
    { $rename: { brewingInstructions: 'usageInstructions' } }
  );
  // 2) Where both exist, keep the new value and drop the stale legacy field.
  const cleaned = await col.updateMany(
    { brewingInstructions: { $exists: true }, usageInstructions: { $exists: true } },
    { $unset: { brewingInstructions: '' } }
  );

  const remaining = await col.countDocuments({ brewingInstructions: { $exists: true } });
  console.log(`\n✅ APPLIED`);
  console.log(`   renamed:  matched ${renamed.matchedCount}, modified ${renamed.modifiedCount}`);
  console.log(`   cleaned:  matched ${cleaned.matchedCount}, modified ${cleaned.modifiedCount}`);
  console.log(`   remaining docs with legacy field: ${remaining} (expected 0)`);

  await mongoose.disconnect();
  process.exit(0);
})().catch((err) => {
  console.error('\n✖ Migration failed:', err.message);
  process.exit(1);
});
