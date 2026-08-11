import { config } from 'dotenv';
config({ path: '.env' });
config({ path: '.env.local', override: true });

import { getMongoDb, closeMongo } from '../src/config/mongo';

const HYDRATE = [
  'users','profiles','roles','categories','sub_categories','brands','products','product_emi_plans',
  'cart_items','wishlist_items','orders','order_items','emi_details','addresses','customer_kyc',
  'experian_reports','digilocker_reports','banners','job_openings','job_applications','general_applications',
  'notifications','reviews','dealers','suppliers','manufacturers','warehouses','branches','pincodes',
  'wholesalers','delivery_partners','delivery_zones','otps','refresh_tokens','audit_log','supportTicket',
  'support_tickets','emi_applications','emiApplication','emiDetail','paymentTransaction','orderTracking',
  'panVerification','customerVerification','notification','loanAccount','loan_accounts','emi_schedules',
  'aadhaarVerification','bankVerification','userAddress','mobileVerification','autopayMandate','fi_cases',
  'bank_accounts','settings',
];

async function main() {
  const db = await getMongoDb();
  const cols = await db.listCollections({}, { nameOnly: true }).toArray();
  const existing = new Set(cols.map((c) => c.name));
  console.log('mongo_total=' + existing.size);
  const unique = [...new Set(HYDRATE)];
  const present = unique.filter((n) => existing.has(n));
  const missing = unique.filter((n) => !existing.has(n));
  console.log('whitelist_unique=' + unique.length);
  console.log('present=' + present.length);
  console.log('missing=' + missing.length);
  console.log('MISSING:\n' + missing.join('\n'));
  console.log('--- counts for present ---');
  for (const name of present) {
    const n = await db.collection(name).estimatedDocumentCount();
    console.log(`${name}=${n}`);
  }
  await closeMongo();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
