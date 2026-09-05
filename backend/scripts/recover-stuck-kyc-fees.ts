/**
 * Production recovery: mark CREATED/PENDING KYC_VERIFICATION rows SUCCESS
 * when Razorpay already captured the payment. Prevents re-charging ₹399.
 *
 * Usage (from backend/):
 *   npx tsx scripts/recover-stuck-kyc-fees.ts
 *   npx tsx scripts/recover-stuck-kyc-fees.ts --dry-run
 *   npx tsx scripts/recover-stuck-kyc-fees.ts --userId=<id>
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { MongoClient } from 'mongodb';
import Razorpay from 'razorpay';

// Prefer real local secrets — ignore Vercel pull files that redact values as "[SENSITIVE]".
// Do NOT override keys already injected by `vercel env run --environment production`.
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: false });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: false });

const URI = process.env.MONGODB_URI?.trim();
const DB_NAME = process.env.MONGODB_DB_NAME?.trim() || 'loanex';
const dryRun = process.argv.includes('--dry-run');
const userIdArg = process.argv.find((a) => a.startsWith('--userId='))?.split('=')[1];

const OPEN = new Set(['CREATED', 'PENDING']);
const KYC_AMOUNT = 399;

async function main() {
  if (!URI || (!URI.startsWith('mongodb://') && !URI.startsWith('mongodb+srv://'))) {
    throw new Error('MONGODB_URI missing or invalid (expected mongodb:// or mongodb+srv://)');
  }
  if (DB_NAME === '[SENSITIVE]') {
    throw new Error('MONGODB_DB_NAME is redacted — load backend/.env instead of .env.production.local');
  }
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error('RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET required for reconcile');
  }
  if (String(process.env.RAZORPAY_KEY_SECRET) === '[SENSITIVE]') {
    throw new Error('Razorpay secrets are redacted — load backend/.env');
  }

  console.log(
    `Connecting db=${DB_NAME} dryRun=${dryRun} razorpayMode=${String(process.env.RAZORPAY_KEY_ID || '').startsWith('rzp_live') ? 'LIVE' : 'TEST/OTHER'}`,
  );

  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db(DB_NAME);
  const col = db.collection('paymentTransaction');

  const filter: Record<string, unknown> = {
    $or: [
      { paymentType: 'KYC_VERIFICATION' },
      { purpose: 'KYC_VERIFICATION' },
    ],
    $and: [
      {
        $or: [
          { paymentStatus: { $in: ['CREATED', 'PENDING'] } },
          { status: { $in: ['CREATED', 'PENDING'] } },
        ],
      },
    ],
  };
  if (userIdArg) filter.userId = userIdArg;

  const rows = await col.find(filter).sort({ createdAt: -1 }).limit(200).toArray();
  console.log(`Found ${rows.length} open KYC fee row(s)${dryRun ? ' [DRY RUN]' : ''}`);

  let recovered = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    const orderId = row.razorpayOrderId ? String(row.razorpayOrderId) : '';
    const status = row.paymentStatus ?? row.status;
    if (!OPEN.has(String(status))) {
      skipped += 1;
      continue;
    }
    if (!orderId || orderId.startsWith('order_dev_')) {
      console.log(`SKIP ${row.id} user=${row.userId} — no real razorpay order`);
      skipped += 1;
      continue;
    }

    try {
      const order = await razorpay.orders.fetch(orderId);
      const payments = await razorpay.orders.fetchPayments(orderId);
      const items = Array.isArray((payments as any)?.items) ? (payments as any).items : [];
      const captured = items.find((p: any) =>
        ['captured', 'authorized'].includes(String(p.status).toLowerCase()),
      );
      const orderPaid = String(order.status).toLowerCase() === 'paid';

      if (!orderPaid && !captured) {
        console.log(
          `SKIP ${row.id} user=${row.userId} order=${orderId} razorpayStatus=${order.status}`,
        );
        skipped += 1;
        continue;
      }

      const amountOk =
        Number(row.amount) === KYC_AMOUNT ||
        Number(order.amount) === KYC_AMOUNT * 100 ||
        (captured && Number(captured.amount) === KYC_AMOUNT * 100);
      if (!amountOk) {
        console.log(`SKIP ${row.id} — amount mismatch amount=${row.amount} orderPaise=${order.amount}`);
        skipped += 1;
        continue;
      }

      const paymentId = captured?.id
        ? String(captured.id)
        : row.razorpayPaymentId
          ? String(row.razorpayPaymentId)
          : `reconcile_${orderId}`;
      const paidAt = new Date().toISOString();

      console.log(
        `${dryRun ? 'WOULD FIX' : 'FIX'} ${row.id} user=${row.userId} order=${orderId} pay=${paymentId}`,
      );

      if (!dryRun) {
        await col.updateOne(
          { id: row.id },
          {
            $set: {
              paymentStatus: 'SUCCESS',
              status: 'SUCCESS',
              purpose: 'KYC_VERIFICATION',
              paymentType: 'KYC_VERIFICATION',
              razorpayPaymentId: paymentId,
              razorpaySignature: row.razorpaySignature ?? 'reconciled_from_razorpay',
              paidAt,
              updatedAt: paidAt,
            },
          },
        );
      }
      recovered += 1;
    } catch (err: any) {
      failed += 1;
      const detail =
        err?.error?.description ||
        err?.error?.reason ||
        err?.description ||
        err?.message ||
        JSON.stringify(err?.error || err);
      console.error(`FAIL ${row.id} order=${orderId}: ${detail}`);
    }
  }

  const successAlt = await col.countDocuments({
    $or: [{ paymentType: 'KYC_VERIFICATION' }, { purpose: 'KYC_VERIFICATION' }],
    paymentStatus: 'SUCCESS',
  });

  console.log(
    JSON.stringify(
      {
        dryRun,
        scanned: rows.length,
        recovered,
        skipped,
        failed,
        successKycRows: successAlt,
      },
      null,
      2,
    ),
  );

  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
