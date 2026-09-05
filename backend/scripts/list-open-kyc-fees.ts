/**
 * List open KYC fee rows (no Razorpay calls) for ops awareness.
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { MongoClient } from 'mongodb';

dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });

async function main() {
  const URI = process.env.MONGODB_URI?.trim();
  const DB_NAME = process.env.MONGODB_DB_NAME?.trim() || 'loanex';
  if (!URI) throw new Error('MONGODB_URI missing');

  const client = new MongoClient(URI);
  await client.connect();
  const col = client.db(DB_NAME).collection('paymentTransaction');

  const open = await col
    .find({
      $or: [{ paymentType: 'KYC_VERIFICATION' }, { purpose: 'KYC_VERIFICATION' }],
      $and: [
        {
          $or: [
            { paymentStatus: { $in: ['CREATED', 'PENDING'] } },
            { status: { $in: ['CREATED', 'PENDING'] } },
          ],
        },
      ],
    })
    .project({
      id: 1,
      userId: 1,
      razorpayOrderId: 1,
      razorpayPaymentId: 1,
      paymentStatus: 1,
      status: 1,
      amount: 1,
      createdAt: 1,
      updatedAt: 1,
    })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray();

  const success = await col.countDocuments({
    $or: [{ paymentType: 'KYC_VERIFICATION' }, { purpose: 'KYC_VERIFICATION' }],
    paymentStatus: 'SUCCESS',
  });

  console.log(JSON.stringify({ openCount: open.length, successCount: success, open }, null, 2));
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
