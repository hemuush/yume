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
// app/add-transaction.tsx) to auto-categorise loan and Friends & Family
// transactions, so they're protected from delete/archive/rename.
//
// Colours are drawn from CATEGORY_COLOR_PALETTE (src/constants/theme.ts) —
// the same calm pastel band the category colour picker itself offers —
// rather than a separate, more saturated palette. A few are deliberately
// reused across a conceptually matching pair (Loan Repayment/Investments,
// Salary/Savings Deposit, Gifts Received/Gifts & Donations, and both
// directions of Friends & Family) the same way the original seed did.
export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { name: 'Salary', kind: 'income', icon: 'briefcase', color: '#7FE0A8', sortOrder: 0 },
  { name: 'Business', kind: 'income', icon: 'trending-up', color: '#8FE8C8', sortOrder: 1 },
  { name: 'Interest & Dividends', kind: 'income', icon: 'percent', color: '#C5E0A0', sortOrder: 2 },
  { name: 'Gifts Received', kind: 'income', icon: 'gift', color: '#FFEA9E', sortOrder: 3 },
  { name: 'Other Income', kind: 'income', icon: 'plus-circle', color: '#A8D8FF', sortOrder: 4 },
  {
    name: 'Loan Repayment',
    kind: 'income',
    icon: 'cash-refund',
    color: '#8FE0DC',
    sortOrder: 5,
    system: true,
  },
  {
    name: 'Friends & Family',
    kind: 'income',
    icon: 'account-multiple',
    color: '#D8B8FF',
    sortOrder: 6,
    system: true,
  },

  { name: 'Food & Dining', kind: 'expense', icon: 'silverware-fork-knife', color: '#FF9E7D', sortOrder: 10 },
  { name: 'Groceries', kind: 'expense', icon: 'cart', color: '#FFC24D', sortOrder: 11 },
  { name: 'Rent', kind: 'expense', icon: 'home', color: '#FF8FA3', sortOrder: 12 },
  { name: 'Utilities', kind: 'expense', icon: 'flash', color: '#8FE0F0', sortOrder: 13 },
  { name: 'Transport', kind: 'expense', icon: 'car', color: '#8FCBFF', sortOrder: 14 },
  { name: 'Fuel', kind: 'expense', icon: 'gas-station', color: '#A8B8FF', sortOrder: 15 },
  { name: 'Health & Medical', kind: 'expense', icon: 'heart-pulse', color: '#FFA8CE', sortOrder: 16 },
  { name: 'Shopping', kind: 'expense', icon: 'shopping', color: '#C9B8FF', sortOrder: 17 },
  { name: 'Entertainment', kind: 'expense', icon: 'movie-open', color: '#FFD84D', sortOrder: 18 },
  { name: 'Education', kind: 'expense', icon: 'book-open-variant', color: '#A8D8FF', sortOrder: 19 },
  { name: 'Subscriptions', kind: 'expense', icon: 'sync', color: '#8FE8C8', sortOrder: 20 },
  { name: 'Insurance', kind: 'expense', icon: 'shield-check', color: '#E0C29A', sortOrder: 21 },
  {
    name: 'Loan EMI',
    kind: 'expense',
    icon: 'credit-card',
    color: '#E0A8C9',
    sortOrder: 22,
    system: true,
  },
  { name: 'Credit Card Payment', kind: 'expense', icon: 'credit-card', color: '#C5E0A0', sortOrder: 23 },
  {
    name: 'Investments',
    kind: 'expense',
    icon: 'chart-bar',
    color: '#8FE0DC',
    sortOrder: 24,
    sensitive: true,
  },
  {
    name: 'Savings Deposit',
    kind: 'expense',
    icon: 'piggy-bank',
    color: '#7FE0A8',
    sortOrder: 25,
    sensitive: true,
  },
  { name: 'Gifts & Donations', kind: 'expense', icon: 'gift', color: '#FFEA9E', sortOrder: 26 },
  { name: 'Travel', kind: 'expense', icon: 'airplane', color: '#8FE0F0', sortOrder: 27 },
  {
    name: 'Fees & Charges',
    kind: 'expense',
    icon: 'file-document',
    color: '#E0C29A',
    sortOrder: 28,
    system: true,
  },
  {
    name: 'Friends & Family',
    kind: 'expense',
    icon: 'account-multiple',
    color: '#D8B8FF',
    sortOrder: 29,
    system: true,
  },
  { name: 'Miscellaneous', kind: 'expense', icon: 'dots-horizontal-circle', color: '#A8D8FF', sortOrder: 30 },
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
