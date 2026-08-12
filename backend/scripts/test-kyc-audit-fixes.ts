/**
 * Focused KYC audit-fix verification. No real Razorpay/DigiLocker/Experian charges.
 */
import 'dotenv/config';
import { MongoClient } from 'mongodb';
import { VerificationStatus, PaymentStatus, PaymentType } from '@prisma/client';
import { jsonDb } from '../src/config/json-db';
import { verificationRepository } from '../src/modules/verification/repository/verification.repository';
import { verificationService } from '../src/modules/verification/service/verification.service';
import { emiApplicationService } from '../src/modules/emi-application/service/emi-application.service';
import { paymentRepository } from '../src/modules/payment/repository/payment.repository';
import { emiApplicationRepository } from '../src/modules/emi-application/repository/emi-application.repository';

const suffix = String(Date.now()).slice(-8);
const unpaidUserId = `kyc-fix-unpaid-${suffix}`;
const paidUserId = `kyc-fix-paid-${suffix}`;
const verifiedUserId = `kyc-fix-verified-${suffix}`;

function assert(cond: any, msg: string) {
  if (!cond) throw new Error(msg);
}

async function wipeMemoryKyc(userId: string) {
  const col = jsonDb.getCollection('customer_kyc');
  for (let i = col.length - 1; i >= 0; i--) {
    if (col[i]?.userId === userId) col.splice(i, 1);
  }
}

async function seedEligibleUser(userId: string, phone: string) {
  const now = new Date().toISOString();
  // Direct Mongo + memory so findUserById / verification gates resolve.
  await jsonDb.insertAwaited('users', {
    id: userId,
    phone,
    email: `${userId}@example.com`,
    role: 'authenticated',
    status: 'ACTIVE',
    mobileVerified: true,
    mobile_verified: true,
    createdAt: now,
    updatedAt: now,
  });
  await jsonDb.insertAwaited('profiles', {
    id: userId,
    mobile_number: phone,
    fullName: 'KYC Fee Test',
    email: `${userId}@example.com`,
    createdAt: now,
    updatedAt: now,
  });
  await verificationRepository.upsertKyc(userId, {
    aadharVerified: true,
    aadhar_number: 'XXXX-XXXX-9999',
    fullName: 'KYC Fee Test',
    pan_verified: true,
    panNumber: 'ABCDE1234F',
    cibil_score: 700,
  });
  await emiApplicationRepository.upsertCustomerVerification(userId, {
    mobileVerified: true,
    aadhaarVerified: true,
    panVerified: true,
    bankVerified: false,
    verificationStatus: VerificationStatus.COMPLETED,
    cibilScore: 700,
  });
}

async function main() {
  await jsonDb.ready;
  const results: Record<string, string> = {};

  const unpaidPhone = `91${suffix}`.slice(0, 10);
  const paidPhone = `92${suffix}`.slice(0, 10);
  await seedEligibleUser(unpaidUserId, unpaidPhone);
  await seedEligibleUser(paidUserId, paidPhone);

  // B: EMI create without fee must fail with KYC_FEE_REQUIRED
  let unpaidRejected = false;
  try {
    await emiApplicationService.create(unpaidUserId, {
      productId: '00000000-0000-4000-8000-000000000099',
      sellingPrice: 10000,
      requestedDownPayment: 1000,
      requestedAmount: 9000,
      tenureMonths: 6,
    } as any);
  } catch (e: any) {
    unpaidRejected = true;
    const code = e?.details?.code ?? e?.code;
    assert(
      /KYC verification fee must be paid/i.test(String(e?.message || e)),
      `unexpected unpaid error: ${e?.message}`,
    );
    assert(code === 'KYC_FEE_REQUIRED', `expected KYC_FEE_REQUIRED got ${code}`);
  }
  assert(unpaidRejected, 'unpaid EMI create must be rejected');
  results.emiRejectUnpaid = 'PASS';

  // Seed SUCCESS KYC fee for paid user (no Razorpay)
  await paymentRepository.createKycVerificationTransaction({
    userId: paidUserId,
    razorpayOrderId: `order_test_${suffix}`,
    amount: 399,
    currency: 'INR',
  });
  const pending = await paymentRepository.findByRazorpayOrderId(`order_test_${suffix}`);
  assert(pending, 'pending KYC txn missing');
  await paymentRepository.completeKycVerificationPayment({
    transactionId: pending.id,
    razorpayPaymentId: `pay_test_${suffix}`,
    razorpaySignature: 'test_sig',
  });
  assert(
    (await paymentRepository.findSuccessKycVerification(paidUserId))?.paymentStatus ===
      PaymentStatus.SUCCESS,
    'SUCCESS KYC fee not found',
  );
  results.feeSeed = 'PASS';

  // A: paid user must pass fee gate (may fail later on missing product — OK)
  try {
    await emiApplicationService.create(paidUserId, {
      productId: '00000000-0000-4000-8000-000000000099',
      sellingPrice: 10000,
      requestedDownPayment: 1000,
      requestedAmount: 9000,
      tenureMonths: 6,
    } as any);
  } catch (e: any) {
    const msg = String(e?.message || e);
    const code = e?.details?.code ?? e?.code;
    assert(code !== 'KYC_FEE_REQUIRED', `paid user must not hit KYC_FEE_REQUIRED: ${msg}`);
    assert(!/KYC verification fee must be paid/i.test(msg), `paid user fee rejection: ${msg}`);
  }
  results.emiAllowPaidFeeGate = 'PASS';

  await jsonDb.refreshCollection('paymentTransaction');
  const paidTxns = jsonDb
    .findMany('paymentTransaction', { userId: paidUserId })
    .filter(
      (p: any) =>
        (p.paymentType === PaymentType.KYC_VERIFICATION || p.purpose === 'KYC_VERIFICATION') &&
        p.paymentStatus === PaymentStatus.SUCCESS,
    );
  assert(paidTxns.length === 1, `expected exactly 1 SUCCESS KYC fee, got ${paidTxns.length}`);
  results.noExtraFee = 'PASS';

  // Durability + re-verify blocks
  await verificationRepository.upsertKyc(verifiedUserId, {
    aadharVerified: true,
    aadhar_number: 'XXXX-XXXX-1234',
    fullName: 'KYC Test User',
    pan_verified: true,
    panNumber: 'ABCDE1234F',
    cibil_score: 750,
  });
  // Need a user row so digilockerGenerate/findUserById works
  await jsonDb.insertAwaited('users', {
    id: verifiedUserId,
    phone: `93${suffix}`.slice(0, 10),
    email: `${verifiedUserId}@example.com`,
    role: 'authenticated',
    status: 'ACTIVE',
    mobileVerified: true,
  });
  await jsonDb.insertAwaited('profiles', {
    id: verifiedUserId,
    mobile_number: `93${suffix}`.slice(0, 10),
    fullName: 'KYC Test User',
  });

  const client = new MongoClient(process.env.MONGODB_URI!, {
    serverSelectionTimeoutMS: 20000,
    family: 4,
  });
  await client.connect();
  const db = client.db(process.env.MONGODB_DB_NAME || 'loanex');
  const mongoKyc = await db.collection('customer_kyc').findOne({ userId: verifiedUserId });
  assert(mongoKyc?.aadharVerified === true, 'Aadhaar not durable in Mongo');
  assert(mongoKyc?.pan_verified === true, 'PAN not durable in Mongo');
  results.mongoDurabilityWrite = 'PASS';

  await wipeMemoryKyc(verifiedUserId);
  assert(!jsonDb.findOne('customer_kyc', { userId: verifiedUserId }), 'memory wipe failed');
  const refreshed = await verificationRepository.findKycByUserId(verifiedUserId);
  assert(refreshed?.aadharVerified === true, 'findKycByUserId must reload from Mongo');
  assert(refreshed?.pan_verified === true, 'PAN must reload from Mongo');
  results.crossInstanceRefresh = 'PASS';

  await wipeMemoryKyc(verifiedUserId);
  const summary = await emiApplicationRepository.findKycSummary(verifiedUserId);
  assert(summary?.aadharVerified === true, 'findKycSummary must reload from Mongo');
  results.emiSummaryRefresh = 'PASS';

  const gen = await verificationService.digilockerGenerate(verifiedUserId);
  assert((gen as any).alreadyVerified === true, 'digilockerGenerate must short-circuit');
  assert((gen as any).digilocker_url == null, 'must not return new DigiLocker URL');
  results.aadhaarReverifyBlockedGenerate = 'PASS';

  const fetch = await verificationService.digilockerFetch(verifiedUserId, 'dummy-client');
  assert((fetch as any).alreadyVerified === true, 'digilockerFetch must short-circuit');
  results.aadhaarReverifyBlockedFetch = 'PASS';

  const pan = await verificationService.verifyPanAndCreditScore(verifiedUserId, {
    pan: 'ABCDE1234F',
  });
  assert((pan as any).alreadyVerified === true, 'verifyPanAndCreditScore must short-circuit');
  results.panReverifyBlocked = 'PASS';

  await wipeMemoryKyc(verifiedUserId);
  const status = await verificationService.getStatus(verifiedUserId);
  assert(status.aadhaarVerified === true, 'getStatus Aadhaar after wipe');
  assert(status.panVerified === true, 'getStatus PAN after wipe');
  results.coldStartStatus = 'PASS';

  // Cleanup only this test's rows
  const ids = [unpaidUserId, paidUserId, verifiedUserId];
  await db.collection('emi_applications').deleteMany({ userId: { $in: ids } });
  await db.collection('customer_kyc').deleteMany({ userId: { $in: ids } });
  await db.collection('paymentTransaction').deleteMany({ userId: { $in: ids } });
  await db.collection('users').deleteMany({ id: { $in: ids } });
  await db.collection('profiles').deleteMany({ id: { $in: ids } });
  await db.collection('customerVerification').deleteMany({ userId: { $in: ids } });
  await client.close();

  console.log(JSON.stringify({ results }, null, 2));
  // Force exit — open Mongo pool from jsonDb otherwise keeps the process alive.
  process.exit(0);
}

main().catch((err) => {
  console.error('TEST_FAILED', err instanceof Error ? err.message : err);
  process.exit(1);
});
