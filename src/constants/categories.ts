import { CategoryKind } from '@/types';

export interface DefaultCategory {
  name: string;
  kind: CategoryKind;
  icon: string;
  color: string;
  sortOrder: number;
  /** Starts flagged for "hide savings & investment amounts" (Settings) — the user can turn this off, or on for any other category, any time. */
  sensitive?: boolean;
  /** A built-in category the app finds by name to auto-file real transactions (loan EMIs, fees, Friends & Family cash entries). Locked from delete/archive/rename so that lookup can't break. */
  system?: boolean;
}

// Seeded once on first launch. Everything here is user-editable/archivable
// afterward, EXCEPT the five flagged `system: true` — those are matched by
// name at runtime (src/features/loans/*, src/features/PeopleSection.tsx,
// app/add-historical.tsx) to auto-categorise loan and Friends & Family
// transactions, so they're protected from delete/archive/rename.
export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { name: 'Salary', kind: 'income', icon: 'briefcase', color: '#22C55E', sortOrder: 0 },
  { name: 'Business', kind: 'income', icon: 'trending-up', color: '#16A34A', sortOrder: 1 },
  { name: 'Interest & Dividends', kind: 'income', icon: 'percent', color: '#15803D', sortOrder: 2 },
  { name: 'Gifts Received', kind: 'income', icon: 'gift', color: '#4ADE80', sortOrder: 3 },
  { name: 'Other Income', kind: 'income', icon: 'plus-circle', color: '#86EFAC', sortOrder: 4 },
  {
    name: 'Loan Repayment',
    kind: 'income',
    icon: 'cash-refund',
    color: '#0F766E',
    sortOrder: 5,
    system: true,
  },
  {
    name: 'Friends & Family',
    kind: 'income',
    icon: 'account-multiple',
    color: '#65A30D',
    sortOrder: 6,
    system: true,
  },

  { name: 'Food & Dining', kind: 'expense', icon: 'silverware-fork-knife', color: '#F97316', sortOrder: 10 },
  { name: 'Groceries', kind: 'expense', icon: 'cart', color: '#EA580C', sortOrder: 11 },
  { name: 'Rent', kind: 'expense', icon: 'home', color: '#DC2626', sortOrder: 12 },
  { name: 'Utilities', kind: 'expense', icon: 'flash', color: '#B91C1C', sortOrder: 13 },
  { name: 'Transport', kind: 'expense', icon: 'car', color: '#0EA5E9', sortOrder: 14 },
  { name: 'Fuel', kind: 'expense', icon: 'gas-station', color: '#0284C7', sortOrder: 15 },
  { name: 'Health & Medical', kind: 'expense', icon: 'heart-pulse', color: '#E11D48', sortOrder: 16 },
  { name: 'Shopping', kind: 'expense', icon: 'shopping', color: '#A855F7', sortOrder: 17 },
  { name: 'Entertainment', kind: 'expense', icon: 'movie-open', color: '#8B5CF6', sortOrder: 18 },
  { name: 'Education', kind: 'expense', icon: 'book-open-variant', color: '#6366F1', sortOrder: 19 },
  { name: 'Subscriptions', kind: 'expense', icon: 'sync', color: '#4F46E5', sortOrder: 20 },
  { name: 'Insurance', kind: 'expense', icon: 'shield-check', color: '#334155', sortOrder: 21 },
  {
    name: 'Loan EMI',
    kind: 'expense',
    icon: 'credit-card',
    color: '#78350F',
    sortOrder: 22,
    system: true,
  },
  { name: 'Credit Card Payment', kind: 'expense', icon: 'credit-card', color: '#92400E', sortOrder: 23 },
  {
    name: 'Investments',
    kind: 'expense',
    icon: 'chart-bar',
    color: '#0D9488',
    sortOrder: 24,
    sensitive: true,
  },
  {
    name: 'Savings Deposit',
    kind: 'expense',
    icon: 'piggy-bank',
    color: '#0F766E',
    sortOrder: 25,
    sensitive: true,
  },
  { name: 'Gifts & Donations', kind: 'expense', icon: 'gift', color: '#DB2777', sortOrder: 26 },
  { name: 'Travel', kind: 'expense', icon: 'airplane', color: '#0891B2', sortOrder: 27 },
  {
    name: 'Fees & Charges',
    kind: 'expense',
    icon: 'file-document',
    color: '#57534E',
    sortOrder: 28,
    system: true,
  },
  {
    name: 'Friends & Family',
    kind: 'expense',
    icon: 'account-multiple',
    color: '#65A30D',
    sortOrder: 29,
    system: true,
  },
  { name: 'Miscellaneous', kind: 'expense', icon: 'dots-horizontal-circle', color: '#71717A', sortOrder: 30 },
];

// A curated MaterialCommunityIcons set for the Add/Edit Category icon picker
// — every name here is a real MCI glyph, spanning the icons already seeded
// above plus a wide range of extras (food/drink, fitness, home, tech,
// health, finance) so a custom or subcategory (Zomato, gym, Netflix, a pet)
// almost always finds something closer than the generic 'tag' default.
export const CATEGORY_ICON_CHOICES: string[] = [
  'tag',
  'silverware-fork-knife',
  'cart',
  'home',
  'flash',
  'car',
  'gas-station',
  'bus',
  'train',
  'heart-pulse',
  'shopping',
  'movie-open',
  'book-open-variant',
  'sync',
  'shield-check',
  'credit-card',
  'chart-bar',
  'piggy-bank',
  'gift',
  'airplane',
  'file-document',
  'briefcase',
  'trending-up',
  'percent',
  'plus-circle',
  'cash-refund',
  'phone',
  'wifi',
  'paw',
  'baby-face-outline',
  'school',
  'tools',
  'dots-horizontal-circle',
  // Food & drink
  'coffee',
  'food-apple',
  'pizza',
  'cake-variant',
  'beer',
  'glass-wine',
  // Family & pets
  'baby-carriage',
  'dog',
  'cat',
  // Fitness & sport
  'run',
  'dumbbell',
  'swim',
  'bike',
  'basketball',
  'football',
  'golf',
  // Transport
  'motorbike',
  'taxi',
  'truck',
  'parking',
  // Home & maintenance
  'hammer-wrench',
  'lightbulb-on',
  'water',
  'washing-machine',
  'fridge',
  'sofa',
  'garage',
  'toolbox',
  // Tech & entertainment
  'television',
  'laptop',
  'cellphone',
  'headphones',
  'gamepad-variant',
  'camera',
  'printer',
  'music',
  'palette',
  // Health
  'tooth',
  'pill',
  'medical-bag',
  'stethoscope',
  'glasses',
  // Money & finance
  'currency-inr',
  'bank',
  'safe',
  'wallet',
  'receipt',
  'calculator',
  'chart-pie',
  'hand-coin',
  // Misc
  'ticket',
  'popcorn',
  'flower',
  'tree',
  'recycle',
  'umbrella',
  'party-popper',
  'key-variant',
  'lock',
  'account-group',
  'pencil',
];
