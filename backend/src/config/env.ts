import { randomBytes } from 'crypto';
import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

loadEnv();
// Local override file (gitignored). Used when `.env` was corrupted by
// secret-redaction placeholders like `[SENSITIVE]`.
loadEnv({ path: '.env.local', override: true });

/** Treat secret-redaction placeholders as unset so Zod defaults can apply. */
for (const [key, value] of Object.entries(process.env)) {
  if (value === '[SENSITIVE]') {
    delete process.env[key];
  }
}

// Local-dev bootstraps when placeholders wiped required values.
// Never used when NODE_ENV is already production.
if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_ENV ??= 'development';
  if (!process.env.JWT_ACCESS_SECRET || process.env.JWT_ACCESS_SECRET.length < 16) {
    process.env.JWT_ACCESS_SECRET = randomBytes(32).toString('hex');
  }
  if (!process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET.length < 16) {
    process.env.JWT_REFRESH_SECRET = randomBytes(32).toString('hex');
  }
  process.env.RAZORPAY_KEY_ID ??= 'rzp_test_local_dev_only';
  process.env.RAZORPAY_KEY_SECRET ??= 'local_dev_razorpay_secret_do_not_use_in_prod';
  process.env.SUPABASE_SYNC_MODE ??= 'source';
  process.env.DATA_PRIMARY ??= 'mongodb';
  process.env.PAYMENT_DEV_BYPASS ??= 'true';
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  APP_NAME: z.string().default('LoanEx API'),
  API_PREFIX: z.string().default('/api/v1'),
  /** MongoDB Atlas is the single source of truth — no PostgreSQL/Supabase mirror. */
  MONGODB_URI: z
    .string()
    .trim()
    .min(1, 'MONGODB_URI is required — MongoDB is the only supported data store'),
  MONGODB_DB_NAME: z.string().optional().default('loanex'),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGINS: z
    .string()
    .default(
      'https://customer-web-beige-iota.vercel.app,https://loanex.vercel.app,https://www.mrloanex.com,https://mrloanex.com,https://www.loanex.in,https://loanex.in,https://admin-app-five-tan.vercel.app,https://loanex-admin-web.vercel.app,https://admin.mrloanex.com,http://localhost:4200',
    ),
  FRONTEND_URL: z.string().optional().default('https://www.mrloanex.com'),
  OTP_LENGTH: z.coerce.number().default(6),
  OTP_EXPIRES_MINUTES: z.coerce.number().default(10),
  OTP_DEV_ECHO: z
    .string()
    .optional()
    .transform((value) => value === 'true'),
  OTP_MAX_ATTEMPTS: z.coerce.number().default(5),
  OTP_MAX_RESEND: z.coerce.number().default(3),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().default(30),
  /** Authkey SMS gateway (customer OTP). */
  AUTHKEY_API_KEY: z.string().optional().default(''),
  AUTHKEY_SENDER_ID: z.string().default('LOAINP'),
  AUTHKEY_TEMPLATE_ID: z.string().default('1777178609288974856'),
  AUTHKEY_PE_ID: z.string().optional().default(''),
  AUTHKEY_SID: z.string().optional().default(''),
  AUTHKEY_COUNTRY_CODE: z.string().default('91'),
  /** Notification SMS — separate DLT template from the OTP template. */
  NOTIFY_SMS_TEMPLATE_ID: z.string().optional().default(''),
  NOTIFY_SMS_SENDER_ID: z.string().optional().default(''),
  /** Email notifications — SMTP (works with any provider: SES, Brevo, Gmail, …). */
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z
    .string()
    .optional()
    .transform((value) => value === 'true'),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  SMTP_FROM: z
    .string()
    .optional()
    .default('LoanEx Notifications <no-reply@loanex.in>'),
  /** WhatsApp notifications — Meta Cloud API. */
  WHATSAPP_ACCESS_TOKEN: z.string().optional().default(''),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional().default(''),
  WHATSAPP_TEMPLATE_NAME: z.string().optional().default('loanex_notification'),
  WHATSAPP_LANGUAGE_CODE: z.string().optional().default('en'),
  WHATSAPP_API_VERSION: z.string().optional().default('v21.0'),
  BCRYPT_SALT_ROUNDS: z.coerce.number().default(12),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900_000),
  /** Global /api budget per IP per window (production). */
  RATE_LIMIT_MAX: z.coerce.number().default(2_000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().default(60),
  MOBILE_OTP_EXPIRES_MINUTES: z.coerce.number().default(5),
  MOBILE_OTP_MAX_RESEND: z.coerce.number().default(3),
  MOBILE_OTP_MAX_ATTEMPTS: z.coerce.number().default(5),
  MOBILE_OTP_RESEND_COOLDOWN_MS: z.coerce.number().default(30_000),
  AADHAAR_OTP_EXPIRES_MINUTES: z.coerce.number().default(5),
  AADHAAR_OTP_MAX_RESEND: z.coerce.number().default(3),
  AADHAAR_OTP_MAX_ATTEMPTS: z.coerce.number().default(5),
  AADHAAR_OTP_RESEND_COOLDOWN_MS: z.coerce.number().default(60_000),
  VERIFICATION_RATE_LIMIT_MAX: z.coerce.number().default(120),
  /** Required in production — no fallback test keys. */
  RAZORPAY_KEY_ID: z.string().min(1),
  RAZORPAY_KEY_SECRET: z.string().min(1),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional().default(''),
  RAZORPAY_CURRENCY: z.string().default('INR'),
  GST_PERCENT: z.coerce.number().default(18),
  EMI_LATE_FEE_PERCENT: z.coerce.number().default(2),
  /** Cash-on-delivery cap — COD orders above this amount are blocked. */
  COD_MAX_AMOUNT: z.coerce.number().default(50_000),
  AUTOPAY_PROVIDER: z.string().default('RAZORPAY'),
  PAYMENT_DEV_BYPASS: z
    .string()
    .optional()
    .transform((value) => value === 'true'),
  /**
   * Optional — used ONLY for career-resume object storage. MongoDB is the
   * data source of truth; there is no database mirroring to Supabase anymore.
   * When unset, resume uploads fall back to local/embedded storage.
   */
  SUPABASE_URL: z.string().optional().default(''),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().default(''),
  /** Secret for the internal cron endpoint (EMI reminders). Vercel Cron sends it as Bearer token when configured. */
  CRON_SECRET: z.string().optional().default(''),
  /** IDSPay / DigiLocker — required for Aadhaar KYC (no hardcoded fallbacks). */
  DIGILOCKER_API_ID: z.string().optional().default(''),
  DIGILOCKER_API_KEY: z.string().optional().default(''),
  DIGILOCKER_TOKEN_ID: z.string().optional().default(''),
  /**
   * Bank verification: when false/missing, bank verify fails closed
   * (no silent self-attestation success).
   */
  BANK_VERIFICATION_PROVIDER: z.string().optional().default(''),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

// Fail-fast boot guard: MongoDB is the single source of truth. If the URI is
// missing, refuse to boot instead of serving stale local/bootstrap data.
if (!env.MONGODB_URI?.trim()) {
  console.error(
    '[BOOT-FAIL] MONGODB_URI is not configured. MongoDB Atlas is the single source of truth ' +
      '— the backend will not start without it. Set MONGODB_URI in .env and restart.',
  );
  process.exit(1);
}

if (env.NODE_ENV === 'production') {
  if (env.OTP_DEV_ECHO) {
    console.error('[SECURITY] OTP_DEV_ECHO must be false in production — forcing off');
    (env as { OTP_DEV_ECHO: boolean }).OTP_DEV_ECHO = false;
  }
  if (env.PAYMENT_DEV_BYPASS) {
    console.error('[SECURITY] PAYMENT_DEV_BYPASS must be false in production — forcing off');
    (env as { PAYMENT_DEV_BYPASS: boolean }).PAYMENT_DEV_BYPASS = false;
  }
  if (!env.AUTHKEY_API_KEY?.trim()) {
    console.error('[SECURITY] AUTHKEY_API_KEY is missing — OTP send will fail closed');
  }
  if (
    env.RAZORPAY_KEY_ID.startsWith('rzp_test_') ||
    env.RAZORPAY_KEY_ID.includes('loanex_key')
  ) {
    console.warn(
      '[SECURITY] RAZORPAY_KEY_ID appears to be a test/placeholder key in production',
    );
  }
  if (
    env.JWT_ACCESS_SECRET.includes('change_me') ||
    env.JWT_REFRESH_SECRET.includes('change_me') ||
    env.JWT_ACCESS_SECRET.length < 32 ||
    env.JWT_REFRESH_SECRET.length < 32
  ) {
    console.warn('[SECURITY] Weak JWT secrets detected in production — rotate immediately');
  }
}

/** Always allow known production frontends even if CORS_ORIGINS was narrowed in deploy env. */
const REQUIRED_PRODUCTION_ORIGINS = [
  'https://customer-web-beige-iota.vercel.app',
  'https://loanex.vercel.app',
  'https://www.mrloanex.com',
  'https://mrloanex.com',
  'https://www.loanex.in',
  'https://loanex.in',
  'https://admin-app-five-tan.vercel.app',
  'https://loanex-admin-web.vercel.app',
  'https://admin.mrloanex.com',
];

export const corsOrigins = [
  ...env.CORS_ORIGINS.split(','),
  env.FRONTEND_URL ?? '',
  ...(env.NODE_ENV === 'production' ? REQUIRED_PRODUCTION_ORIGINS : []),
]
  .map((origin) => origin.trim())
  .filter(Boolean)
  .filter((origin) => {
    if (env.NODE_ENV === 'production' && /localhost|127\.0\.0\.1/i.test(origin)) {
      return false;
    }
    return true;
  })
  .filter((origin, index, all) => all.indexOf(origin) === index);
