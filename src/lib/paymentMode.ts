import type { PaymentMode } from '@/types';

export const PAYMENT_METHODS: { value: PaymentMode; label: string }[] = [
  { value: 'upi', label: 'UPI' },
  { value: 'cash', label: 'Cash' },
  { value: 'debit', label: 'Debit card' },
  { value: 'credit', label: 'Credit card' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'other', label: 'Other' },
];
export const isPaymentMode = (value: unknown): value is PaymentMode =>
  PAYMENT_METHODS.some((method) => method.value === value);
export const paymentMethodLabel = (value: PaymentMode | null | undefined) =>
  PAYMENT_METHODS.find((method) => method.value === value)?.label ?? 'Not recorded';
