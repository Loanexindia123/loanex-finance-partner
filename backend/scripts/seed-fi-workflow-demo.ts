/**
 * Seed / upsert a consistent FI workflow demo graph.
 * Safe: only writes ids with the tmp-fi-demo- / tmp-active-app- prefixes.
 *
 * Creates:
 *   EMI UNDER_REVIEW + FI pending  (no loan / order / payments)
 *
 * Run: npx tsx scripts/seed-fi-workflow-demo.ts
 */
import 'dotenv/config';
import { config as loadEnv } from 'dotenv';
import { EmiApplicationStatus } from '@prisma/client';
import { jsonDb } from '../src/config/json-db';

loadEnv({ path: '.env.local', override: true });

const APP_ID = 'tmp-active-app-0001';
const FI_ID = 'df3b46b3-7f77-4061-a3d3-b05c6c8b50e8';
const USER_ID = 'b934a373-d989-4732-91a3-fa54848c2b3e';
const PRODUCT_ID = '51667d14-4e96-4b4f-a31c-d44d5de77c03';
const PRODUCT_NAME = 'Google Pixel 9 Pro';

async function main() {
  await jsonDb.ready;
  await jsonDb.deferredReady;

  const profile = jsonDb.findOne('profiles', { id: USER_ID });
  const customerName = profile?.fullName ?? 'Gouri Musharraf';
  const mobile = profile?.mobileNumber ?? profile?.mobile_number ?? '9462557060';
  const now = new Date().toISOString();

  const existingApp = jsonDb.findOne('emi_applications', { id: APP_ID });
  if (existingApp) {
    await jsonDb.updateAwaited(
      'emi_applications',
      { id: APP_ID },
      {
        status: EmiApplicationStatus.UNDER_REVIEW,
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
        productName: PRODUCT_NAME,
        productId: PRODUCT_ID,
      },
    );
  } else {
    await jsonDb.insertAwaited('emi_applications', {
      id: APP_ID,
      applicationNumber: 'LX-EMI-20260811-9001',
      userId: USER_ID,
      productId: PRODUCT_ID,
      productName: PRODUCT_NAME,
      sellingPrice: 109999,
      requestedAmount: 109999,
      requestedDownPayment: 0,
      requestedTenure: 6,
      estimatedMonthlyEmi: 19007.34,
      interestRate: 12.5,
      status: EmiApplicationStatus.UNDER_REVIEW,
      adminRemarks: 'Demo FI workflow — awaiting field investigation',
      submittedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }

  const existingFi = jsonDb.findOne('fi_cases', { id: FI_ID });
  if (existingFi) {
    await jsonDb.updateAwaited(
      'fi_cases',
      { id: FI_ID },
      {
        applicationId: APP_ID,
        userId: USER_ID,
        customerName,
        mobile,
        productName: PRODUCT_NAME,
        status: 'pending',
        photoCount: 0,
        gpsLocation: '',
        remarks: '',
        assignedExecutive: existingFi.assignedExecutive || 'Unassigned',
      },
    );
  } else {
    await jsonDb.insertAwaited('fi_cases', {
      id: FI_ID,
      applicationId: APP_ID,
      userId: USER_ID,
      customerName,
      mobile,
      productName: PRODUCT_NAME,
      assignedExecutive: 'Unassigned',
      assignedDate: now,
      status: 'pending',
      photoCount: 0,
      gpsLocation: '',
      remarks: '',
      createdAt: now,
      updatedAt: now,
    });
  }

  // Remove any leftover demo loan/order/payment/schedule/credit-review for this app.
  for (const loanCol of ['loanAccount', 'loan_accounts'] as const) {
    const loan = jsonDb.findOne(loanCol, { applicationId: APP_ID });
    if (loan && String(loan.id).startsWith('tmp-')) {
      for (const sch of jsonDb.findMany('emi_schedules', { loanAccountId: loan.id })) {
        if (String(sch.id).startsWith('tmp-')) {
          await jsonDb.deleteAwaited('emi_schedules', { id: sch.id });
        }
      }
      await jsonDb.deleteAwaited(loanCol, { id: loan.id });
    }
  }

  const order = jsonDb.findOne('orders', { applicationId: APP_ID });
  if (order && String(order.id).startsWith('tmp-')) {
    await jsonDb.deleteAwaited('orders', { id: order.id });
  }

  for (const p of jsonDb.findMany('paymentTransaction', { applicationId: APP_ID })) {
    if (String(p.id).startsWith('tmp-')) {
      await jsonDb.deleteAwaited('paymentTransaction', { id: p.id });
    }
  }

  if (jsonDb.findOne('credit_reviews', { applicationId: APP_ID })) {
    await jsonDb.deleteAwaited('credit_reviews', { applicationId: APP_ID });
  }

  const app = jsonDb.findOne('emi_applications', { id: APP_ID });
  const fi = jsonDb.findOne('fi_cases', { id: FI_ID });
  console.log(
    JSON.stringify(
      {
        ok: true,
        app: { id: app?.id, status: app?.status },
        fi: { id: fi?.id, status: fi?.status, applicationId: fi?.applicationId },
        loan: jsonDb.findOne('loanAccount', { applicationId: APP_ID })?.id ?? null,
        order: jsonDb.findOne('orders', { applicationId: APP_ID })?.id ?? null,
      },
      null,
      2,
    ),
  );

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
