/**
 * One-shot repair: reset inconsistent demo FI/EMI graph for tmp-active-* only.
 * Writes through getMongoDb() with id/_id dual match (mirrorUpdate used to miss rows).
 *
 * Run (backend stopped): npx tsx scripts/repair-fi-emi-demo-mismatch.ts
 */
import 'dotenv/config';
import { config as loadEnv } from 'dotenv';
import { closeMongo, getMongoDb } from '../src/config/mongo';

loadEnv({ path: '.env.local', override: true });

const APP_ID = 'tmp-active-app-0001';
const LOAN_ID = 'tmp-active-loan-0001';
const ORDER_ID = 'tmp-active-order-0001';
const FI_ID = 'df3b46b3-7f77-4061-a3d3-b05c6c8b50e8';
const TXN_ID = 'tmp-txn-emi1';

function idFilter(id: string) {
  return { $or: [{ _id: id }, { id }] };
}

async function main() {
  const db = await getMongoDb();

  const beforeApp = await db.collection('emi_applications').findOne(idFilter(APP_ID));
  if (!beforeApp || beforeApp.id !== APP_ID) {
    throw new Error(`Refusing repair: demo app missing (${APP_ID})`);
  }

  const beforeFi = await db.collection('fi_cases').findOne(idFilter(FI_ID));
  const beforeLoan =
    (await db.collection('loanAccount').findOne(idFilter(LOAN_ID))) ||
    (await db.collection('loan_accounts').findOne(idFilter(LOAN_ID))) ||
    (await db.collection('loanAccount').findOne({ applicationId: APP_ID })) ||
    (await db.collection('loan_accounts').findOne({ applicationId: APP_ID }));

  console.log(
    JSON.stringify(
      {
        before: {
          app: { id: beforeApp.id, status: beforeApp.status, _id: beforeApp._id },
          fi: beforeFi
            ? { id: beforeFi.id, status: beforeFi.status, applicationId: beforeFi.applicationId }
            : null,
          loan: beforeLoan
            ? { id: beforeLoan.id, loanStatus: beforeLoan.loanStatus }
            : null,
        },
      },
      null,
      2,
    ),
  );

  const now = new Date().toISOString();

  const appUpdate = await db.collection('emi_applications').updateMany(idFilter(APP_ID), {
    $set: {
      status: 'UNDER_REVIEW',
      approvedAmount: null,
      approvedTenure: null,
      approvedDownPayment: null,
      monthlyEmi: null,
      processingFee: null,
      adminRemarks: 'Demo FI workflow — awaiting field investigation',
      rejectionReason: null,
      reviewedAt: null,
      termsModifiedAt: null,
      offerAcceptedAt: null,
      offerDeclinedAt: null,
      updatedAt: now,
    },
  });

  const fiUpdate = await db.collection('fi_cases').updateMany(
    {
      $or: [
        { _id: FI_ID },
        { id: FI_ID },
        { applicationId: APP_ID },
        { userId: beforeApp.userId },
      ],
    },
    {
      $set: {
        applicationId: APP_ID,
        status: 'pending',
        photoCount: 0,
        gpsLocation: '',
        remarks: '',
        updatedAt: now,
      },
    },
  );

  const schDel = await db.collection('emi_schedules').deleteMany({
    $or: [
      { loanAccountId: LOAN_ID },
      { loanAccountId: beforeLoan?.id },
      { id: { $regex: '^tmp-sch-active-' } },
    ],
  });
  const loanDel1 = await db.collection('loanAccount').deleteMany({
    $or: [idFilter(LOAN_ID), { applicationId: APP_ID }, { id: { $regex: '^tmp-active-loan-' } }],
  });
  const loanDel2 = await db.collection('loan_accounts').deleteMany({
    $or: [idFilter(LOAN_ID), { applicationId: APP_ID }, { id: { $regex: '^tmp-active-loan-' } }],
  });
  const orderDel = await db.collection('orders').deleteMany({
    $or: [idFilter(ORDER_ID), { applicationId: APP_ID }, { id: { $regex: '^tmp-active-order-' } }],
  });
  const payDel = await db.collection('paymentTransaction').deleteMany({
    $or: [idFilter(TXN_ID), { applicationId: APP_ID }, { id: { $regex: '^tmp-txn-' } }],
  });
  const creditDel = await db.collection('credit_reviews').deleteMany({ applicationId: APP_ID });

  const afterApp = await db.collection('emi_applications').findOne(idFilter(APP_ID));
  const afterFi = await db.collection('fi_cases').findOne(idFilter(FI_ID));
  const afterLoan =
    (await db.collection('loanAccount').findOne({ applicationId: APP_ID })) ||
    (await db.collection('loan_accounts').findOne({ applicationId: APP_ID }));
  const afterOrder = await db.collection('orders').findOne({ applicationId: APP_ID });
  const afterSch = await db.collection('emi_schedules').countDocuments({
    $or: [{ loanAccountId: LOAN_ID }, { id: { $regex: '^tmp-sch-active-' } }],
  });

  const ok =
    afterApp?.status === 'UNDER_REVIEW' &&
    afterFi?.status === 'pending' &&
    !afterLoan &&
    !afterOrder &&
    afterSch === 0;

  console.log(
    JSON.stringify(
      {
        writes: {
          appMatched: appUpdate.matchedCount,
          appModified: appUpdate.modifiedCount,
          fiMatched: fiUpdate.matchedCount,
          fiModified: fiUpdate.modifiedCount,
          schedulesDeleted: schDel.deletedCount,
          loansDeleted: loanDel1.deletedCount + loanDel2.deletedCount,
          ordersDeleted: orderDel.deletedCount,
          paymentsDeleted: payDel.deletedCount,
          creditDeleted: creditDel.deletedCount,
        },
        after: {
          app: afterApp
            ? { id: afterApp.id, status: afterApp.status, remarks: afterApp.adminRemarks }
            : null,
          fi: afterFi
            ? { id: afterFi.id, status: afterFi.status, applicationId: afterFi.applicationId }
            : null,
          loan: afterLoan?.id ?? null,
          order: afterOrder?.id ?? null,
          schedules: afterSch,
        },
        ok,
      },
      null,
      2,
    ),
  );

  await closeMongo();
  process.exit(ok ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  await closeMongo().catch(() => undefined);
  process.exit(1);
});
