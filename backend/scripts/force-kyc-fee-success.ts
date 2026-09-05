/**
 * Immediate ops recovery for a known paid KYC customer whose row is stuck CREATED.
 * Does NOT call Razorpay — only use when payment capture is confirmed by ops.
 *
 * Usage:
 *   npx tsx scripts/force-kyc-fee-success.ts --userId=<id> --orderId=<razorpayOrderId>
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { MongoClient } from 'mongodb';

dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });

const URI = process.env.MONGODB_URI?.trim();
const DB_NAME = process.env.MONGODB_DB_NAME?.trim() || 'loanex';
const userId = process.argv.find((a) => a.startsWith('--userId='))?.split('=')[1];
const orderId = process.argv.find((a) => a.startsWith('--orderId='))?.split('=')[1];

async function main() {
  if (!URI?.startsWith('mongodb')) throw new Error('MONGODB_URI invalid');
  if (!userId) throw new Error('--userId required');

  const client = new MongoClient(URI);
  await client.connect();
  const col = client.db(DB_NAME).collection('paymentTransaction');

  const existingSuccess = await col.findOne({
    userId,
    paymentType: 'KYC_VERIFICATION',
    paymentStatus: 'SUCCESS',
  });
  if (existingSuccess) {
    console.log(
      JSON.stringify(
        {
          alreadyPaid: true,
          paymentId: existingSuccess.id,
          razorpayOrderId: existingSuccess.razorpayOrderId,
          paidAt: existingSuccess.paidAt,
        },
        null,
        2,
      ),
    );
    await client.close();
    return;
  }

  const filter: Record<string, unknown> = {
    userId,
    amount: 399,
    $or: [{ paymentType: 'KYC_VERIFICATION' }, { purpose: 'KYC_VERIFICATION' }],
    paymentStatus: { $in: ['CREATED', 'PENDING'] },
  };
  if (orderId) filter.razorpayOrderId = orderId;

  const row = await col.find(filter).sort({ createdAt: 1 }).limit(1).next();
  if (!row) throw new Error('No open KYC fee row found for user');

  const paidAt = new Date().toISOString();
  const paymentId =
    row.razorpayPaymentId ||
    `manual_reconcile_${row.razorpayOrderId || row.id}`;

  await col.updateOne(
    { id: row.id },
    {
      $set: {
        paymentStatus: 'SUCCESS',
        status: 'SUCCESS',
        purpose: 'KYC_VERIFICATION',
        paymentType: 'KYC_VERIFICATION',
        razorpayPaymentId: paymentId,
        razorpaySignature: 'manual_ops_reconcile_confirmed_paid',
        paidAt,
        updatedAt: paidAt,
      },
    },
  );

  const after = await col.findOne({ id: row.id });
  console.log(
    JSON.stringify(
      {
        recovered: true,
        userId,
        paymentId: after?.id,
        razorpayOrderId: after?.razorpayOrderId,
        razorpayPaymentId: after?.razorpayPaymentId,
        paymentStatus: after?.paymentStatus,
        paidAt: after?.paidAt,
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
