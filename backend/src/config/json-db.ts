import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { getMongoDb } from './mongo';
import { normalizeAddressRow, normalizeOrderRow } from './mirror-sanitize';

const { appendFileSync } = fs;

const DB_FILE_PATH = path.join(process.cwd(), 'data', 'db.json');

// Ensure directory exists when the filesystem is writable (local/dev).
// On Vercel the app root is read-only; source mode skips local persistence.
const dataDir = path.dirname(DB_FILE_PATH);
try {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
} catch {
  /* ignore EROFS / permission errors on serverless */
}

export interface LocalDatabaseSchema {
  users: any[];
  profiles: any[];
  roles: any[];
  categories: any[];
  sub_categories: any[];
  brands: any[];
  products: any[];
  product_emi_plans: any[];
  cart_items: any[];
  wishlist_items: any[];
  orders: any[];
  order_items: any[];
  emi_details: any[];
  addresses: any[];
  customer_kyc: any[];
  experian_reports: any[];
  digilocker_reports: any[];
  banners: any[];
  job_openings: any[];
  job_applications: any[];
  general_applications: any[];
  notifications: any[];
  reviews: any[];
  dealers: any[];
  suppliers: any[];
  manufacturers: any[];
  warehouses: any[];
  branches: any[];
  pincodes: any[];
  wholesalers: any[];
  delivery_partners: any[];
  delivery_zones: any[];
  product_types: any[];
  employees: any[];
}

const DEFAULT_INITIAL_DATA: LocalDatabaseSchema = {
  // No seeded demo customer — accounts are created through the real auth flow.
  users: [],
  roles: [
    {
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Super Admin',
      description: 'Full access to every module in the admin portal',
      permissions: [
        'products.view', 'products.create', 'products.edit', 'products.delete',
        'orders.view', 'orders.edit', 'orders.delete',
        'customers.view', 'customers.edit', 'customers.delete',
        'emi.view', 'emi.edit', 'emi.delete',
        'fi.view', 'fi.edit', 'fi.delete',
        'users.view', 'users.create', 'users.edit', 'users.delete',
        'roles.view', 'roles.create', 'roles.edit', 'roles.delete',
        'reports.view',
        'masters.view', 'masters.create', 'masters.edit', 'masters.delete',
        'settings.view', 'settings.edit',
        'notifications.view', 'notifications.create', 'notifications.delete',
      ],
      is_system: true,
      isSystem: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: '00000000-0000-4000-8000-000000000002',
      name: 'Branch Manager',
      description: 'Run branch operations: orders, EMI approvals and field investigation',
      permissions: [
        'products.view',
        'orders.view', 'orders.edit',
        'customers.view',
        'emi.view', 'emi.edit',
        'fi.view', 'fi.edit',
        'reports.view',
      ],
      is_system: false,
      isSystem: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: '00000000-0000-4000-8000-000000000003',
      name: 'Credit Officer',
      description: 'Review and approve credit: EMI applications, loans and payment terms',
      permissions: [
        'products.view',
        'orders.view',
        'customers.view',
        'emi.view', 'emi.edit',
        'fi.view',
        'reports.view',
      ],
      is_system: false,
      isSystem: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: '00000000-0000-4000-8000-000000000004',
      name: 'FI Executive',
      description: 'Field investigation: view and update FI cases only',
      permissions: ['customers.view', 'emi.view', 'fi.view', 'fi.edit'],
      is_system: false,
      isSystem: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: '00000000-0000-4000-8000-000000000005',
      name: 'Sales Executive',
      description: 'Product catalog: view, add and edit products',
      permissions: ['products.view', 'products.create', 'products.edit', 'customers.view', 'orders.view'],
      is_system: false,
      isSystem: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: '00000000-0000-4000-8000-000000000006',
      name: 'Employee',
      description: 'Employee portal: products, product masters and own dealers',
      permissions: [
        'products.view',
        'products.create',
        'products.edit',
        'masters.view',
        'masters.create',
        'masters.edit',
      ],
      is_system: false,
      isSystem: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  profiles: [],
  categories: [
    {
      id: 'a1111111-1111-4111-8111-111111111101',
      name: 'Smartphone',
      description: 'Flagship and mid-range smartphones',
      icon: 'pi pi-mobile',
      color: '#3b82f6',
      bgColor: '#eff6ff',
      status: 'active',
      sortOrder: 1,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'a1111111-1111-4111-8111-111111111102',
      name: 'Laptop',
      description: 'Ultrabooks, gaming and creator laptops',
      icon: 'pi pi-desktop',
      color: '#10b981',
      bgColor: '#ecfdf5',
      status: 'active',
      sortOrder: 2,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'a1111111-1111-4111-8111-111111111103',
      name: 'Smart TV',
      description: '4K and QLED smart televisions',
      icon: 'pi pi-desktop',
      color: '#8b5cf6',
      bgColor: '#f5f3ff',
      status: 'active',
      sortOrder: 3,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'a1111111-1111-4111-8111-111111111104',
      name: 'Refrigerator',
      description: 'Frost-free and inverter refrigerators',
      icon: 'pi pi-home',
      color: '#0ea5e9',
      bgColor: '#f0f9ff',
      status: 'active',
      sortOrder: 4,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'a1111111-1111-4111-8111-111111111105',
      name: 'Washing Machine',
      description: 'Front load and top load washing machines',
      icon: 'pi pi-sync',
      color: '#f59e0b',
      bgColor: '#fffbeb',
      status: 'active',
      sortOrder: 5,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'a1111111-1111-4111-8111-111111111106',
      name: 'Air Conditioner',
      description: 'Inverter split air conditioners',
      icon: 'pi pi-sun',
      color: '#14b8a6',
      bgColor: '#f0fdfa',
      status: 'active',
      sortOrder: 6,
      createdAt: new Date().toISOString(),
    },
  ],
  sub_categories: [],
  brands: [
    { id: 'brand-apple', name: 'Apple', logo: '', status: 'active' },
    { id: 'brand-dell', name: 'Dell', logo: '', status: 'active' },
    { id: 'brand-samsung', name: 'Samsung', logo: '', status: 'active' },
    { id: 'brand-sony', name: 'Sony', logo: '', status: 'active' },
  ],
  product_types: [
    { id: 'ptype-smartphone', name: 'Smartphone', status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'ptype-tablet', name: 'Tablet', status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'ptype-laptop', name: 'Laptop', status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'ptype-accessories', name: 'Accessories', status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'ptype-smartwatch', name: 'Smartwatch', status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'ptype-audio', name: 'Audio', status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  ],
  employees: [],
  products: [],
  product_emi_plans: [],
  cart_items: [],
  wishlist_items: [],
  orders: [],
  order_items: [],
  emi_details: [],
  addresses: [],
  customer_kyc: [],
  experian_reports: [],
  digilocker_reports: [],
  banners: [
    {
      id: 'b1111111-1111-4111-8111-111111111101',
      title: 'Zero Down Payment Festive EMI Offer',
      subtitle: 'Get your dream smartphone at 0% interest with instant digital KYC',
      badgeText: 'HOT OFFER',
      badge_text: 'HOT OFFER',
      image_url: 'https://images.unsplash.com/photo-1695048133142-1a204986d903?w=1200&q=80',
      imageUrl: 'https://images.unsplash.com/photo-1695048133142-1a204986d903?w=1200&q=80',
      link: '/products?category=Smartphone',
      placement: 'home',
      sort_order: 1,
      status: 'active',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'b1111111-1111-4111-8111-111111111102',
      title: 'Laptops & Workstations On Easy EMI',
      subtitle: 'Instant approval in under 2 minutes on top laptop brands',
      badgeText: 'NEW LAUNCH',
      badge_text: 'NEW LAUNCH',
      image_url: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=1200&q=80',
      imageUrl: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=1200&q=80',
      link: '/products?category=Laptop',
      placement: 'home',
      sort_order: 2,
      status: 'active',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'b1111111-1111-4111-8111-111111111110',
      title: 'Exciting Offers. Bigger Benefits.',
      subtitle: 'Unlock exclusive EMI deals, festive discounts, and zero-cost plans on top brands.',
      badgeText: 'Explore Offers',
      badge_text: 'Explore Offers',
      image_url: 'https://images.unsplash.com/photo-1607083206869-4c79793e7914?w=1200&q=80',
      imageUrl: 'https://images.unsplash.com/photo-1607083206869-4c79793e7914?w=1200&q=80',
      link: '/products',
      placement: 'promotional',
      sort_order: 10,
      status: 'active',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'b1111111-1111-4111-8111-111111111120',
      title: 'Smart Home Appliances Festival',
      subtitle: 'TVs, refrigerators, washers and ACs with flexible monthly EMIs',
      badgeText: 'APPLIANCES',
      badge_text: 'APPLIANCES',
      image_url: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=1200&q=80',
      imageUrl: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=1200&q=80',
      link: '/products?category=Smart%20TV',
      placement: 'product',
      sort_order: 20,
      status: 'active',
      createdAt: new Date().toISOString(),
    },
  ],
  job_openings: [
    {
      id: 'a1111111-1111-4111-8111-111111111111',
      slug: 'frontend-developer',
      title: 'Frontend Developer',
      department: 'Engineering',
      location: 'Bengaluru / Hybrid',
      employmentType: 'Full-time',
      experience: '2–4 years',
      shortDescription: 'Build polished Angular experiences for LoanEx customer web.',
      description:
        'As a Frontend Developer at LoanEx, you will craft high-quality UI for our EMI shopping platform and partner with design and backend teams.',
      responsibilities: [
        'Develop Angular features',
        'Ship responsive accessible UI',
        'Collaborate on API-driven flows',
        'Improve performance and quality',
      ],
      requirements: [
        'Strong Angular and TypeScript',
        'Solid HTML/CSS/SCSS',
        'Familiarity with RxJS',
        'Clear communication',
      ],
      skills: ['Angular', 'TypeScript', 'SCSS', 'RxJS', 'REST APIs'],
      benefits: [
        'Competitive compensation',
        'Learning budget',
        'Hybrid flexibility',
        'Health coverage',
      ],
      status: 'active',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'a2222222-2222-4222-8222-222222222222',
      slug: 'backend-developer',
      title: 'Backend Developer',
      department: 'Engineering',
      location: 'Bengaluru / Hybrid',
      employmentType: 'Full-time',
      experience: '3–5 years',
      shortDescription: 'Design secure APIs that power EMI, payments, and verification.',
      description:
        'Build scalable services behind LoanEx. Own APIs, data models, and integrations that keep lending and checkout reliable.',
      responsibilities: [
        'Design REST APIs',
        'Integrate payment and KYC providers',
        'Ensure security and observability',
        'Partner with frontend and admin teams',
      ],
      requirements: [
        'Node.js/Express experience',
        'Strong SQL fundamentals',
        'Auth and security awareness',
        'Cloud debugging comfort',
      ],
      skills: ['Node.js', 'TypeScript', 'PostgreSQL', 'REST', 'Prisma'],
      benefits: [
        'Competitive compensation',
        'Learning budget',
        'Hybrid flexibility',
        'Health coverage',
      ],
      status: 'active',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'a3333333-3333-4333-8333-333333333333',
      slug: 'ui-ux-designer',
      title: 'UI/UX Designer',
      department: 'Design',
      location: 'Bengaluru / Hybrid',
      employmentType: 'Full-time',
      experience: '2–4 years',
      shortDescription: 'Shape clear EMI shopping and onboarding experiences.',
      description:
        'Improve clarity across shopping, KYC, and EMI journeys. Turn complex finance flows into simple, confident experiences.',
      responsibilities: [
        'Own end-to-end UX for key journeys',
        'Create wireframes and high-fidelity designs',
        'Run usability checks',
        'Evolve the design system',
      ],
      requirements: [
        'Strong product design portfolio',
        'Figma proficiency',
        'Form-heavy/fintech experience a plus',
        'Stakeholder communication',
      ],
      skills: ['Figma', 'Design Systems', 'Prototyping', 'User Research', 'Accessibility'],
      benefits: [
        'Competitive compensation',
        'Learning budget',
        'Hybrid flexibility',
        'Creative toolkit support',
      ],
      status: 'active',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'a4444444-4444-4444-8444-444444444444',
      slug: 'sales-executive',
      title: 'Sales Executive',
      department: 'Growth',
      location: 'Bengaluru / On-site',
      employmentType: 'Full-time',
      experience: '1–3 years',
      shortDescription: 'Drive merchant and customer growth for LoanEx EMI.',
      description:
        'Expand LoanEx adoption through relationship building, demos, and conversion-focused conversations.',
      responsibilities: [
        'Qualify leads',
        'Present EMI value propositions',
        'Manage pipeline and conversion metrics',
        'Coordinate onboarding with product/support',
      ],
      requirements: [
        'Prior sales/BD experience preferred',
        'Strong communication',
        'CRM comfort',
        'Self-motivated',
      ],
      skills: [
        'Consultative Selling',
        'CRM',
        'Negotiation',
        'Presentation',
        'Pipeline Management',
      ],
      benefits: [
        'Competitive base + incentives',
        'Career growth path',
        'Health coverage',
        'Performance bonuses',
      ],
      status: 'active',
      createdAt: new Date().toISOString(),
    },
  ],
  job_applications: [],
  general_applications: [],
  notifications: [],
  reviews: [],
  dealers: [
    { id: 'dealer-001', name: 'Dealer X', code: 'DLR-X', status: 'active' },
    { id: 'dealer-002', name: 'Dealer Y', code: 'DLR-Y', status: 'active' },
  ],
  suppliers: [
    { id: 'supplier-001', name: 'Supplier A', status: 'active' },
    { id: 'supplier-002', name: 'Supplier B', status: 'active' },
  ],
  manufacturers: [],
  warehouses: [
    { id: 'warehouse-001', name: 'Main Hub', status: 'active' },
    { id: 'warehouse-002', name: 'City Center', status: 'active' },
    { id: 'warehouse-003', name: 'North Branch', status: 'active' },
  ],
  branches: [
    {
      id: 'branch-001',
      name: 'Mumbai Andheri',
      branchCode: 'MUM-AND',
      city: 'Mumbai',
      state: 'Maharashtra',
      branchManager: 'Anil Sharma',
      mobile: '+91 98000 11111',
      status: 'active',
    },
    {
      id: 'branch-002',
      name: 'Mumbai Borivali',
      branchCode: 'MUM-BOR',
      city: 'Mumbai',
      state: 'Maharashtra',
      branchManager: 'Arun Mehta',
      mobile: '+91 98000 33333',
      status: 'active',
    },
    {
      id: 'branch-003',
      name: 'Pune Kothrud',
      branchCode: 'PUN-KOT',
      city: 'Pune',
      state: 'Maharashtra',
      branchManager: 'Rahul Mehta',
      mobile: '+91 98000 77777',
      status: 'active',
    },
    {
      id: 'branch-004',
      name: 'Bengaluru Koramangala',
      branchCode: 'BLR-KOR',
      city: 'Bengaluru',
      state: 'Karnataka',
      branchManager: 'Priya Nair',
      mobile: '+91 98000 44444',
      status: 'active',
    },
    {
      id: 'branch-005',
      name: 'Delhi Connaught Place',
      branchCode: 'DEL-CP',
      city: 'New Delhi',
      state: 'Delhi',
      branchManager: 'Vikram Singh',
      mobile: '+91 98000 55555',
      status: 'active',
    },
    {
      id: 'branch-006',
      name: 'Hyderabad Banjara Hills',
      branchCode: 'HYD-BH',
      city: 'Hyderabad',
      state: 'Telangana',
      branchManager: 'Neha Kapoor',
      mobile: '+91 98000 22222',
      status: 'active',
    },
    {
      id: 'branch-007',
      name: 'Chennai T Nagar',
      branchCode: 'CHN-TN',
      city: 'Chennai',
      state: 'Tamil Nadu',
      branchManager: 'Sneha Iyer',
      mobile: '+91 98000 66666',
      status: 'active',
    },
    {
      id: 'branch-008',
      name: 'Ahmedabad CG Road',
      branchCode: 'AMD-CG',
      city: 'Ahmedabad',
      state: 'Gujarat',
      branchManager: 'Kavita Desai',
      mobile: '+91 98000 88888',
      status: 'inactive',
    },
  ],
  pincodes: [
    {
      id: 'pincode-400053',
      name: '400053',
      pincode: '400053',
      city: 'Mumbai',
      state: 'Maharashtra',
      branchName: 'Mumbai Andheri',
      status: 'active',
    },
    {
      id: 'pincode-400069',
      name: '400069',
      pincode: '400069',
      city: 'Mumbai',
      state: 'Maharashtra',
      branchName: 'Mumbai Andheri',
      status: 'active',
    },
    {
      id: 'pincode-400092',
      name: '400092',
      pincode: '400092',
      city: 'Mumbai',
      state: 'Maharashtra',
      branchName: 'Mumbai Borivali',
      status: 'active',
    },
    {
      id: 'pincode-411038',
      name: '411038',
      pincode: '411038',
      city: 'Pune',
      state: 'Maharashtra',
      branchName: 'Pune Kothrud',
      status: 'active',
    },
    {
      id: 'pincode-560034',
      name: '560034',
      pincode: '560034',
      city: 'Bengaluru',
      state: 'Karnataka',
      branchName: 'Bengaluru Koramangala',
      status: 'active',
    },
    {
      id: 'pincode-560001',
      name: '560001',
      pincode: '560001',
      city: 'Bengaluru',
      state: 'Karnataka',
      branchName: 'Bengaluru Koramangala',
      status: 'active',
    },
    {
      id: 'pincode-110001',
      name: '110001',
      pincode: '110001',
      city: 'New Delhi',
      state: 'Delhi',
      branchName: 'Delhi Connaught Place',
      status: 'active',
    },
    {
      id: 'pincode-500034',
      name: '500034',
      pincode: '500034',
      city: 'Hyderabad',
      state: 'Telangana',
      branchName: 'Hyderabad Banjara Hills',
      status: 'active',
    },
    {
      id: 'pincode-600017',
      name: '600017',
      pincode: '600017',
      city: 'Chennai',
      state: 'Tamil Nadu',
      branchName: 'Chennai T Nagar',
      status: 'active',
    },
    {
      id: 'pincode-380009',
      name: '380009',
      pincode: '380009',
      city: 'Ahmedabad',
      state: 'Gujarat',
      branchName: 'Ahmedabad CG Road',
      status: 'inactive',
    },
  ],
  wholesalers: [
    { id: 'wholesaler-001', name: 'Wholesale 1', status: 'active' },
    { id: 'wholesaler-002', name: 'Wholesale 2', status: 'active' },
  ],
  delivery_partners: [
    { id: 'partner-001', name: 'BlueDart', status: 'active', serviceableZones: [] },
    { id: 'partner-002', name: 'Delhivery', status: 'active', serviceableZones: [] },
  ],
  delivery_zones: [
    { id: 'zone-001', name: 'Zone 1', status: 'active' },
    { id: 'zone-002', name: 'Zone 2', status: 'active' },
  ],
};

/**
 * Dead / unused collection names previously listed for hydrate.
 * Verified zero runtime consumers in backend/src (aliases or schema-only).
 * Kept out of cold-start to avoid wasted Mongo round-trips.
 */
const DEAD_HYDRATE_NAMES = new Set([
  'support_tickets', // code uses `supportTicket`
  'emiDetail', // unused; EMI detail lives in loan/emi_schedules paths
  'bank_accounts', // unused
  'order_items', // orders embed line items; no separate reads
  'emi_details', // unused schema/map leftover
  'experian_reports', // Experian payload stored on customer_kyc
  'notifications', // code uses `notification`
]);

/**
 * Admin master collections — not required for customer catalog/auth cold paths.
 * Loaded on demand via ensureCollection() from admin master endpoints.
 */
export const ADMIN_LAZY_COLLECTIONS = [
  'brands',
  'sub_categories',
  'dealers',
  'suppliers',
  'manufacturers',
  'warehouses',
  'branches',
  'pincodes',
  'wholesalers',
  'delivery_partners',
  'delivery_zones',
  'product_types',
  'employees',
] as const;

const ADMIN_LAZY_SET = new Set<string>(ADMIN_LAZY_COLLECTIONS);

/**
 * Collections required before the process may serve catalog / auth / cart.
 * `jsonDb.ready` resolves after this set is hydrated.
 */
const CRITICAL_HYDRATE_COLLECTIONS = [
  'products',
  'categories',
  'banners',
  'product_emi_plans',
  'cart_items',
  'wishlist_items',
  'users',
  'profiles',
  'roles',
  'otps',
  'refresh_tokens',
  'settings',
  'addresses',
] as const;

/**
 * Remaining non-admin collections — hydrated in the background after `ready`.
 * Routes that need them await `jsonDb.deferredReady` (see middleware).
 */
const DEFERRED_HYDRATE_COLLECTIONS = Array.from(
  new Set([
    ...Object.keys(DEFAULT_INITIAL_DATA),
    'otps',
    'refresh_tokens',
    'audit_log',
    'supportTicket',
    'emi_applications',
    'emiApplication',
    'paymentTransaction',
    'orderTracking',
    'panVerification',
    'customerVerification',
    'notification',
    'loanAccount',
    'loan_accounts',
    'emi_schedules',
    'aadhaarVerification',
    'bankVerification',
    'userAddress',
    'mobileVerification',
    'autopayMandate',
    'fi_cases',
    'credit_reviews',
    'roles',
    'job_openings',
    'job_applications',
    'general_applications',
    'settings',
  ]),
).filter(
  (name) =>
    !DEAD_HYDRATE_NAMES.has(name) &&
    !ADMIN_LAZY_SET.has(name) &&
    !(CRITICAL_HYDRATE_COLLECTIONS as readonly string[]).includes(name),
);

const HYDRATE_CONCURRENCY = 12;

function cloneValue<T>(value: T): T {
  return value == null ? value : (JSON.parse(JSON.stringify(value)) as T);
}

function cloneRows<T>(rows: T[]): T[] {
  if (rows.length === 0) return [];
  return JSON.parse(JSON.stringify(rows)) as T[];
}

/** Catalog collections re-fetched on a throttle so Atlas/dashboard inserts
 * surface in product list/detail without a process restart.
 * Kept to the minimum set product list/PDP actually reads from jsonDb. */
const CATALOG_REFRESH_COLLECTIONS = [
  'products',
  'categories',
  'product_emi_plans',
];
const CATALOG_REFRESH_TTL_MS = 15_000;
/** Throttle explicit refreshCollection() calls (admin lists, order lookups). */
const REFRESH_COLLECTION_TTL_MS = 10_000;

class LocalDatabaseEngine {
  private data: LocalDatabaseSchema;
  private readonly warned = new Set<string>();
  private readonly lastRefreshAt = new Map<string, number>();
  /** Collections successfully loaded from Mongo (boot or ensureCollection). */
  private readonly mongoLoaded = new Set<string>();
  private readonly ensureInflight = new Map<string, Promise<void>>();
  /** Coalesce concurrent refreshCollection() calls for the same name. */
  private readonly refreshInflight = new Map<string, Promise<void>>();
  /** Resolves when critical (catalog/auth/cart) collections are hydrated. */
  public readonly ready: Promise<void>;
  /** Resolves when deferred (orders/EMI/KYC/…) collections are hydrated. */
  public readonly deferredReady: Promise<void>;
  /** Last critical hydrate duration in ms (0 if not yet measured). */
  public lastHydrateMs = 0;
  /** Last deferred hydrate duration in ms (0 if not yet measured). */
  public lastDeferredHydrateMs = 0;
  /** Number of collections targeted on the last critical hydrate. */
  public lastHydrateTargetCount = 0;
  /** Collections actually loaded from Mongo on the last critical hydrate. */
  public lastHydrateLoadedCount = 0;

  constructor() {
    this.data = this.loadData();
    // Critical first so catalog/auth can serve quickly; deferred continues after.
    // (Running both in parallel overloaded Atlas and slowed critical hydrate.)
    this.ready = this.hydrateFromMongo(
      CRITICAL_HYDRATE_COLLECTIONS as unknown as string[],
      'critical',
    );
    this.deferredReady = this.ready.then(() =>
      this.hydrateFromMongo(DEFERRED_HYDRATE_COLLECTIONS, 'deferred'),
    );
  }

  private normalizeHydratedRow(name: string, row: Record<string, any>): Record<string, any> {
    if (name === 'orders') return normalizeOrderRow(row);
    if (name === 'addresses') return normalizeAddressRow(row);
    return row;
  }

  private stripMongoId<T extends Record<string, any>>(row: T): T {
    if (!row || typeof row !== 'object') return row;
    const { _id, ...rest } = row as T & { _id?: unknown };
    if (rest.id == null && _id != null) {
      (rest as any).id = String(_id);
    }
    return rest as T;
  }

  private loadData(): LocalDatabaseSchema {
    try {
      if (fs.existsSync(DB_FILE_PATH)) {
        const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        // Merge missing collections if schema updated
        return { ...DEFAULT_INITIAL_DATA, ...parsed };
      }
    } catch (e) {
      console.error('[JSON DB] Error reading DB file, re-initializing...', e);
    }
    this.saveData(DEFAULT_INITIAL_DATA);
    return DEFAULT_INITIAL_DATA;
  }

  /** db.json is never the source of truth anymore — MongoDB is. */
  public saveData(_dataToSave?: LocalDatabaseSchema): void {
    return;
  }

  private existingMongoNames: Set<string> | null = null;

  private async getExistingMongoNames(): Promise<Set<string>> {
    if (this.existingMongoNames) return this.existingMongoNames;
    const db = await getMongoDb();
    this.existingMongoNames = new Set(
      (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name),
    );
    return this.existingMongoNames;
  }

  /**
   * Replace local collections from MongoDB (Atlas).
   * Collections that do not exist in Mongo keep their local/bootstrap data.
   */
  private async hydrateFromMongo(
    names: string[],
    phase: 'critical' | 'deferred',
  ): Promise<void> {
    const started = Date.now();
    if (phase === 'critical') {
      this.lastHydrateTargetCount = names.length;
    }
    let loaded = 0;
    let skipped = 0;
    let failed = 0;
    let rows = 0;
    const successfullyHydrated = new Set<string>();

    try {
      const db = await getMongoDb();
      const existingNames = await this.getExistingMongoNames();
      const hydrateOne = async (name: string): Promise<void> => {
        try {
          if (!existingNames.has(name)) {
            skipped += 1;
            return;
          }
          const data = await db.collection(name).find({}).limit(10000).toArray();
          const normalized = data.map((row) => {
            const clean = this.stripMongoId(row as Record<string, any>);
            return this.normalizeHydratedRow(name, clean);
          });
          (this.data as any)[name] = normalized;
          loaded += 1;
          rows += normalized.length;
          successfullyHydrated.add(name);
          this.mongoLoaded.add(name);
        } catch (e) {
          failed += 1;
          console.error(`[MongoDB] hydrate "${name}" failed:`, e);
        }
      };

      for (let i = 0; i < names.length; i += HYDRATE_CONCURRENCY) {
        const batch = names.slice(i, i + HYDRATE_CONCURRENCY);
        await Promise.all(batch.map((name) => hydrateOne(name)));
      }
    } catch (e) {
      console.error(`[MongoDB] hydrate ${phase} failed:`, e);
      throw e;
    }

    const elapsed = Date.now() - started;
    // Seed refresh TTL for every collection we just loaded so the first
    // admin/list call does not immediately re-download the same data.
    const seededAt = Date.now();
    for (const name of successfullyHydrated) {
      this.lastRefreshAt.set(name, seededAt);
    }
    if (phase === 'critical') {
      this.lastHydrateMs = elapsed;
      this.lastHydrateLoadedCount = loaded;
      const catalogSeeded = CATALOG_REFRESH_COLLECTIONS.filter((name) =>
        successfullyHydrated.has(name),
      ).length;
      console.info(
        `[MongoDB] critical hydrated ${loaded}/${names.length} collections in ${elapsed}ms ` +
          `(rows=${rows}, skipped=${skipped}, failed=${failed}, concurrency=${HYDRATE_CONCURRENCY}, ` +
          `catalogRefreshSeeded=${catalogSeeded}/${CATALOG_REFRESH_COLLECTIONS.length}, ` +
          `deferredPending=${DEFERRED_HYDRATE_COLLECTIONS.length}, adminLazy=${ADMIN_LAZY_COLLECTIONS.length}, ` +
          `deadExcluded=${DEAD_HYDRATE_NAMES.size})`,
      );
    } else {
      this.lastDeferredHydrateMs = elapsed;
      console.info(
        `[MongoDB] deferred hydrated ${loaded}/${names.length} collections in ${elapsed}ms ` +
          `(rows=${rows}, skipped=${skipped}, failed=${failed}, concurrency=${HYDRATE_CONCURRENCY})`,
      );
    }
  }

  /**
   * Ensure a collection has been loaded from Mongo at least once in this process.
   * Used for admin-lazy masters and any deferred collection. Concurrent callers
   * share a single in-flight refresh.
   */
  public async ensureCollection(name: string): Promise<void> {
    if (this.mongoLoaded.has(name)) return;
    const inflight = this.ensureInflight.get(name);
    if (inflight) {
      await inflight;
      return;
    }
    const work = (async () => {
      await this.refreshCollection(name);
    })().finally(() => {
      this.ensureInflight.delete(name);
    });
    this.ensureInflight.set(name, work);
    await work;
  }

  /**
   * Re-fetch catalog collections from MongoDB on a throttle so records added
   * directly in Atlas surface in the API without a process restart.
   */
  public async refreshCatalogThrottled(): Promise<void> {
    const now = Date.now();
    const due = CATALOG_REFRESH_COLLECTIONS.filter(
      (name) => (this.lastRefreshAt.get(name) ?? 0) + CATALOG_REFRESH_TTL_MS <= now,
    );
    if (due.length === 0) return;

    try {
      const db = await getMongoDb();
      await Promise.all(
        due.map(async (name) => {
          try {
            const data = await db.collection(name).find({}).limit(10000).toArray();
            (this.data as any)[name] = data.map((row) => this.stripMongoId(row as any));
            this.lastRefreshAt.set(name, now);
            this.mongoLoaded.add(name);
          } catch (e) {
            console.error(`[MongoDB] catalog refresh "${name}" failed:`, e);
          }
        }),
      );
    } catch (e) {
      console.error('[MongoDB] catalog refresh failed:', e);
    }
  }

  /** Force one full refresh pass of the catalog collections (bypasses throttle). */
  public async refreshCatalogNow(): Promise<void> {
    this.lastRefreshAt.clear();
    await this.refreshCatalogThrottled();
  }

  private logMirrorError(name: string, operation: string, message: string): void {
    const line = `[${new Date().toISOString()}] ${operation} "${name}" failed: ${message}`;
    if (!this.warned.has(name)) {
      this.warned.add(name);
      console.error(`[Mirror] ${line}`);
    }
    try {
      appendFileSync('mirror-errors.log', line + '\n');
    } catch {
      /* ignore */
    }
  }

  private async mirrorInsert(name: string, item: any): Promise<void> {
    try {
      const db = await getMongoDb();
      const payload = { ...item };
      const id = String(payload.id || randomUUID());
      payload.id = id;
      // Avoid null unique-index collisions (slug/orderNumber/etc.)
      for (const f of [
        'slug',
        'sku',
        'orderNumber',
        'applicationNumber',
        'loanAccountNumber',
        'razorpayOrderId',
        'email',
        'phone',
        'token',
      ]) {
        if (payload[f] == null) delete payload[f];
      }
      await db.collection(name).replaceOne({ _id: id as any }, { ...payload, _id: id }, { upsert: true });
    } catch (e) {
      this.logMirrorError(name, 'insert', String(e));
      throw e;
    }
  }

  private async mirrorUpdate(name: string, where: Record<string, any>, data: any): Promise<void> {
    try {
      const db = await getMongoDb();
      const filter: Record<string, any> = {};
      for (const [key, value] of Object.entries(where || {})) {
        if (value === undefined) continue;
        // Match either Mongo _id or the business `id` field — older rows may diverge.
        if (key === 'id') filter.$or = [{ _id: String(value) }, { id: String(value) }];
        else filter[key] = value;
      }
      const setDoc = { ...data, updatedAt: data?.updatedAt || new Date().toISOString() };
      delete (setDoc as any)._id;
      await db.collection(name).updateMany(filter, { $set: setDoc });
    } catch (e) {
      this.logMirrorError(name, 'update', String(e));
      throw e;
    }
  }

  private async mirrorDelete(name: string, where: Record<string, any>): Promise<void> {
    try {
      const db = await getMongoDb();
      const filter: Record<string, any> = {};
      const hasFilter = Object.keys(where || {}).some((key) => where[key] !== undefined);
      if (hasFilter) {
        for (const [key, value] of Object.entries(where)) {
          if (value === undefined) continue;
          if (key === 'id') filter.$or = [{ _id: String(value) }, { id: String(value) }];
          else filter[key] = value;
        }
      }
      await db.collection(name).deleteMany(hasFilter ? filter : {});
    } catch (e) {
      this.logMirrorError(name, 'delete', String(e));
    }
  }

  /** Merge a Mongo row into the in-memory collection (by id, else by filter). */
  private upsertLocalRow(
    name: string,
    row: Record<string, any>,
    filter?: Record<string, any>,
  ): void {
    const collection = this.getCollection(name);
    let idx = -1;
    if (row?.id != null) {
      idx = collection.findIndex((item: any) => item.id === row.id);
    }
    if (idx === -1 && filter && Object.keys(filter).length > 0) {
      idx = collection.findIndex((item: any) =>
        Object.keys(filter).every((key) => item[key] === filter[key]),
      );
    }
    if (idx === -1) {
      collection.push(row);
    } else {
      collection[idx] = { ...collection[idx], ...row };
    }
  }

  /**
   * Fetch one document from Mongo and merge into memory.
   * Prefer this over refreshCollection() for status/lookup endpoints —
   * avoids re-downloading entire collections (often 1–3s+ on Atlas).
   */
  public isCollectionLoaded(name: string): boolean {
    return this.mongoLoaded.has(name);
  }

  /**
   * In-memory lookup when the collection is already hydrated; otherwise a
   * targeted Mongo findOne (never a full collection download).
   */
  public async findOneCached(
    name: string,
    filter: Record<string, any>,
  ): Promise<any | null> {
    const local = this.findOne(name, filter);
    if (local || this.mongoLoaded.has(name)) {
      return local;
    }
    return this.findOneFromMongo(name, filter);
  }

  public async findOneFromMongo(
    name: string,
    filter: Record<string, any>,
  ): Promise<any | null> {
    try {
      const db = await getMongoDb();
      const doc = await db.collection(name).findOne(filter);
      if (!doc) {
        return this.findOne(name, filter);
      }
      const clean = this.stripMongoId(doc as Record<string, any>);
      const normalized = this.normalizeHydratedRow(name, clean);
      this.upsertLocalRow(name, normalized, filter);
      return cloneValue(normalized);
    } catch (e) {
      this.logMirrorError(name, 'findOne', String(e));
      return this.findOne(name, filter);
    }
  }

  /**
   * Fetch the latest matching document from Mongo (sorted desc) and merge into memory.
   */
  public async findLatestFromMongo(
    name: string,
    filter: Record<string, any>,
    sortField = 'createdAt',
  ): Promise<any | null> {
    try {
      const db = await getMongoDb();
      const docs = await db
        .collection(name)
        .find(filter)
        .sort({ [sortField]: -1 })
        .limit(1)
        .toArray();
      const doc = docs[0];
      if (!doc) {
        const local = this.findMany(name, filter).sort(
          (a: any, b: any) =>
            new Date(b[sortField] ?? b.createdAt ?? 0).getTime() -
            new Date(a[sortField] ?? a.createdAt ?? 0).getTime(),
        );
        return local[0] ? cloneValue(local[0]) : null;
      }
      const clean = this.stripMongoId(doc as Record<string, any>);
      const normalized = this.normalizeHydratedRow(name, clean);
      this.upsertLocalRow(name, normalized, filter);
      return cloneValue(normalized);
    } catch (e) {
      this.logMirrorError(name, 'findLatest', String(e));
      const local = this.findMany(name, filter).sort(
        (a: any, b: any) =>
          new Date(b[sortField] ?? b.createdAt ?? 0).getTime() -
          new Date(a[sortField] ?? a.createdAt ?? 0).getTime(),
      );
      return local[0] ? cloneValue(local[0]) : null;
    }
  }

  /**
   * Re-read a collection from MongoDB into memory. Keeps list endpoints
   * consistent after another instance wrote rows.
   * Throttled by default (10s) to avoid full re-downloads on every admin click.
   * Pass `{ force: true }` only when a cross-instance stale read must be bypassed.
   */
  public async refreshCollection(
    name: string,
    opts?: { force?: boolean },
  ): Promise<void> {
    const force = opts?.force === true;
    const now = Date.now();
    if (
      !force &&
      this.mongoLoaded.has(name) &&
      now - (this.lastRefreshAt.get(name) ?? 0) < REFRESH_COLLECTION_TTL_MS
    ) {
      return;
    }

    const inflight = this.refreshInflight.get(name);
    if (inflight) {
      await inflight;
      return;
    }

    const work = (async () => {
      try {
        const db = await getMongoDb();
        const data = await db.collection(name).find({}).limit(10000).toArray();
        const normalized = data.map((row) => {
          const clean = this.stripMongoId(row as Record<string, any>);
          return this.normalizeHydratedRow(name, clean);
        });
        (this.data as any)[name] = normalized;
        this.mongoLoaded.add(name);
        this.lastRefreshAt.set(name, Date.now());
      } catch (e) {
        this.logMirrorError(name, 'refresh', String(e));
      }
    })().finally(() => {
      this.refreshInflight.delete(name);
    });

    this.refreshInflight.set(name, work);
    await work;
  }

  /** Empty local collection and await the Mongo delete. */
  public async clearCollectionAwaited(name: string): Promise<number> {
    const collection = this.getCollection(name);
    const count = collection.length;
    (this.data as any)[name] = [];
    this.saveData();
    await this.mirrorDelete(name, {});
    return count;
  }

  public getCollection(name: string): any[] {
    if (!this.data[name as keyof LocalDatabaseSchema]) {
      (this.data as any)[name] = [];
    }
    return (this.data as any)[name];
  }

  public findMany(collectionName: string, where?: Record<string, any>, options?: { orderBy?: string; take?: number }): any[] {
    const list = this.getCollection(collectionName);
    let result = list;

    if (where && Object.keys(where).length > 0) {
      result = list.filter((item) => {
        return Object.keys(where).every((key) => {
          if (where[key] === undefined) return true;
          return item[key] === where[key];
        });
      });
    }

    if (options?.take && options.take > 0) {
      result = result.slice(0, options.take);
    }

    return cloneRows(result);
  }

  public findOne(collectionName: string, where: Record<string, any>): any | null {
    const results = this.findMany(collectionName, where, { take: 1 });
    return results[0] || null;
  }

  public insert(collectionName: string, itemData: any): any {
    const collection = this.getCollection(collectionName);
    // Always use UUID so serverless mirror/hydrate keeps the same id across instances.
    // The old `id_${Date.now()}_…` format was stripped by sanitize (UUID-only) and
    // caused checkout 404s after cold start ("Product not found").
    const id = itemData.id || randomUUID();
    const now = new Date().toISOString();

    const newItem = {
      id,
      ...itemData,
      createdAt: itemData.createdAt || now,
      updatedAt: now,
    };

    collection.push(newItem);
    this.saveData();
    // Fire-and-forget for non-auth collections; auth uses insertAwaited.
    void this.mirrorInsert(collectionName, newItem).catch(() => {
      /* logged in mirrorInsert */
    });
    return cloneValue(newItem);
  }

  /**
   * Insert and wait for the Mongo write — required for auth durability
   * (password hash must survive cold starts / other serverless instances).
   */
  public async insertAwaited(collectionName: string, itemData: any): Promise<any> {
    const collection = this.getCollection(collectionName);
    const id = itemData.id || randomUUID();
    const now = new Date().toISOString();

    const newItem = {
      id,
      ...itemData,
      createdAt: itemData.createdAt || now,
      updatedAt: now,
    };

    collection.push(newItem);
    this.saveData();
    await this.mirrorInsert(collectionName, newItem);
    return cloneValue(newItem);
  }

  public update(collectionName: string, where: Record<string, any>, updateData: any): any {
    const collection = this.getCollection(collectionName);
    const index = collection.findIndex((item) => {
      return Object.keys(where).every((key) => item[key] === where[key]);
    });

    if (index === -1) {
      return null;
    }

    const updatedItem = {
      ...collection[index],
      ...updateData,
      updatedAt: new Date().toISOString(),
    };

    collection[index] = updatedItem;
    this.saveData();
    void this.mirrorUpdate(collectionName, where, {
      ...updateData,
      updatedAt: updatedItem.updatedAt,
    }).catch(() => {
      /* logged in mirrorUpdate */
    });
    return cloneValue(updatedItem);
  }

  public async updateAwaited(
    collectionName: string,
    where: Record<string, any>,
    updateData: any,
  ): Promise<any> {
    const collection = this.getCollection(collectionName);
    const index = collection.findIndex((item) => {
      return Object.keys(where).every((key) => item[key] === where[key]);
    });

    if (index === -1) {
      return null;
    }

    const updatedItem = {
      ...collection[index],
      ...updateData,
      updatedAt: new Date().toISOString(),
    };

    collection[index] = updatedItem;
    this.saveData();
    await this.mirrorUpdate(collectionName, where, {
      ...updateData,
      updatedAt: updatedItem.updatedAt,
    });
    return cloneValue(updatedItem);
  }

  /**
   * Update a row in memory WITHOUT mirroring to Mongo.
   *
   * Used by paths that own their own awaited Mongo write (e.g. the durable
   * inventory decrement), so the change is persisted exactly once instead of
   * being mirrored fire-and-forget (which can be lost on a serverless freeze
   * and would double-write when the durable path already wrote it).
   */
  public updateLocal(collectionName: string, where: Record<string, any>, updateData: any): any {
    const collection = this.getCollection(collectionName);
    const index = collection.findIndex((item) => {
      return Object.keys(where).every((key) => item[key] === where[key]);
    });

    if (index === -1) {
      return null;
    }

    const updatedItem = {
      ...collection[index],
      ...updateData,
      updatedAt: new Date().toISOString(),
    };

    collection[index] = updatedItem;
    this.saveData();
    return cloneValue(updatedItem);
  }

  public upsert(collectionName: string, where: Record<string, any>, updateData: any, createData: any): any {
    const existing = this.findOne(collectionName, where);
    if (existing) {
      return this.update(collectionName, where, updateData);
    }
    return this.insert(collectionName, createData || { ...where, ...updateData });
  }

  public delete(collectionName: string, where: Record<string, any>): any {
    const collection = this.getCollection(collectionName);
    const index = collection.findIndex((item) => {
      return Object.keys(where).every((key) => item[key] === where[key]);
    });

    if (index === -1) return null;

    const [removed] = collection.splice(index, 1);
    this.saveData();
    void this.mirrorDelete(collectionName, where);
    return cloneValue(removed);
  }

  public async deleteAwaited(collectionName: string, where: Record<string, any>): Promise<any> {
    const collection = this.getCollection(collectionName);
    const index = collection.findIndex((item) => {
      return Object.keys(where).every((key) => item[key] === where[key]);
    });

    if (index === -1) return null;

    const [removed] = collection.splice(index, 1);
    this.saveData();
    await this.mirrorDelete(collectionName, where);
    return cloneValue(removed);
  }

  public deleteMany(collectionName: string, where?: Record<string, any>): number {
    const collection = this.getCollection(collectionName);
    if (!where || Object.keys(where).length === 0) {
      const count = collection.length;
      (this.data as any)[collectionName] = [];
      this.saveData();
      void this.mirrorDelete(collectionName, {});
      return count;
    }

    const initialCount = collection.length;
    (this.data as any)[collectionName] = collection.filter((item) => {
      return !Object.keys(where).every((key) => item[key] === where[key]);
    });
    const removedCount = initialCount - (this.data as any)[collectionName].length;
    this.saveData();
    void this.mirrorDelete(collectionName, where);
    return removedCount;
  }

  public count(collectionName: string, where?: Record<string, any>): number {
    const list = this.getCollection(collectionName);
    if (!where || Object.keys(where).length === 0) {
      return list.length;
    }
    return list.filter((item) =>
      Object.keys(where).every((key) => {
        if (where[key] === undefined) return true;
        return item[key] === where[key];
      }),
    ).length;
  }
}

export const jsonDb = new LocalDatabaseEngine();
