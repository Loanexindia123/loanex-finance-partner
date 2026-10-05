import {
  CategoryItem,
  FooterSection,
  MockUser,
  NavItem,
  SocialLink,
} from '../models/layout.models';

/** Local mock data for the application shell (no APIs). */
export const LAYOUT_COMPANY = {
  name: 'LoanEx',
  legalName: 'Loanex India Private Limited',
  tagline: 'Unlock Your Financial Freedom',
  logoSrc: 'assets/images/loanex-logo.png',
  logoAlt: 'LoanEx — Unlock Your Financial Freedom',
  description:
    'LoanEx is a premium FinTech shopping experience that helps you buy what you need with flexible EMI plans — clear pricing, transparent tenure, and a polished checkout journey. LoanEx is a brand of Loanex India Private Limited.',
  email: 'hello@loanex.com',
  phone: '+91 1800 123 4567',
  address: 'Financial District, Bengaluru, India',
} as const;

export const DESKTOP_NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Home', path: '/' },
  { id: 'shop', label: 'Shop', path: '/products' },
  { id: 'categories', label: 'Categories', path: '/', fragment: 'categories' },
  { id: 'how-it-works', label: 'How It Works', path: '/', fragment: 'how-it-works' },
  { id: 'offers', label: 'Offers', path: '/', fragment: 'offers' },
  { id: 'careers', label: 'Careers', path: '/careers', matchPaths: 'subset' },
  { id: 'support', label: 'Support', path: '/support' },
];

/** Primary navbar navigation (approved client menu). */
export const NAVBAR_NAV_ITEMS = DESKTOP_NAV_ITEMS;

export const MEGA_MENU_CATEGORIES: CategoryItem[] = [];

export const FOOTER_SECTIONS: FooterSection[] = [
  {
    id: 'quick',
    title: 'Quick Links',
    links: [
      { id: 'home', label: 'Home', path: '/' },
      { id: 'products', label: 'Products', path: '/products' },
      { id: 'categories', label: 'Categories', path: '/products' },
      { id: 'careers', label: 'Careers', path: '/careers' },
      { id: 'wishlist', label: 'Wishlist', path: '/wishlist' },
      { id: 'cart', label: 'Cart', path: '/cart' },
    ],
  },
  {
    id: 'support',
    title: 'Support',
    links: [
      { id: 'help', label: 'Help Center', path: '/support' },
      { id: 'orders', label: 'Track Orders', path: '/my-orders' },
      { id: 'contact', label: 'Contact Us', path: '/support' },
      { id: 'faq', label: 'FAQs', path: '/support' },
    ],
  },
  {
    id: 'emi',
    title: 'EMI Information',
    links: [
      { id: 'buy-emi', label: 'Buy on EMI', path: '/products' },
      { id: 'my-emi', label: 'My EMI', path: '/my-emi' },
      { id: 'plans', label: 'EMI Plans', path: '/products' },
      { id: 'eligibility', label: 'Eligibility', path: '/support' },
    ],
  },
  {
    id: 'legal',
    title: 'Legal',
    links: [
      { id: 'privacy', label: 'Privacy Policy', unavailable: true },
      { id: 'terms', label: 'Terms of Use', unavailable: true },
      { id: 'refund', label: 'Refund Policy', unavailable: true },
      { id: 'grievance', label: 'Grievance Redressal', unavailable: true },
    ],
  },
];

/**
 * Social profiles — only include entries with a real https URL.
 * No company social URLs are configured in this repo; keep empty so the footer
 * does not render misleading "#" links.
 */
export const SOCIAL_LINKS: SocialLink[] = [];

export const MOCK_COUNTS = {
  cart: 0,
  wishlist: 0,
  notifications: 0,
} as const;

export const MOCK_USER: MockUser = {
  name: '',
  email: '',
  initials: '',
};

/** Path segment → breadcrumb label map for future routes. */
export const BREADCRUMB_LABELS: Record<string, string> = {
  products: 'Products',
  categories: 'Categories',
  wishlist: 'Wishlist',
  cart: 'Cart',
  checkout: 'Checkout',
  orders: 'Orders',
  'my-orders': 'Orders',
  profile: 'Profile',
  emi: 'EMI',
  notifications: 'Notifications',
  support: 'Support',
  careers: 'Careers',
  'general-application': 'General Application',
  apply: 'Apply',
  search: 'Search',
  auth: 'Account',
};

/** Parent path segment → label used when the next segment is a resource id. */
export const BREADCRUMB_ID_PARENT_LABELS: Record<string, string> = {
  products: 'Product Details',
  orders: 'Order Details',
  'my-orders': 'Order Details',
  careers: 'Job Details',
};
