import type { DraftPart } from '@/features/add/splitDraft';

/** Split editor keys are UI identity and must not count as an edited payment. */
export function splitSignature(parts: DraftPart[] | null): string {
  return JSON.stringify(parts?.map((part) => [part.categoryId, part.amountText]) ?? null);
}
