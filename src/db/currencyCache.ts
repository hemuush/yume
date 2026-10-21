// Cached in-memory after first load so formatMoney() etc. can read it synchronously without every call touching
// SQLite. Its own module because both the database client (which primes it at startup) and settings (which stores
// the value) need it, and the client cannot import settings.
export const DEFAULT_CURRENCY = 'INR';

let cachedCurrency: string | null = null;

/** The cached code, or null before anything has loaded or after a reset. */
export function readCurrencyCache(): string | null {
  return cachedCurrency;
}

export function getCachedCurrency(): string {
  return cachedCurrency ?? DEFAULT_CURRENCY;
}

/** For db/client.ts to call during init with an already-open db handle, avoiding a circular getDb() call. */
export function primeCurrencyCache(value: string | null): void {
  cachedCurrency = value ?? DEFAULT_CURRENCY;
}

export function setCurrencyCache(code: string | null): void {
  cachedCurrency = code;
}
