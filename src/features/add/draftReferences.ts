import type { EntryDraft } from './entryDraft';

interface ReferenceData {
  accounts: readonly { id: string; archived: boolean }[];
  categories: readonly { id: string; archived: boolean }[];
  people: readonly { id: string }[];
}

/** Missing selections are editable; stale selections in actual entries need an explicit decision. */
export function draftReferencesAvailable(draft: EntryDraft, data: ReferenceData): boolean {
  const accounts = new Set(data.accounts.filter((a) => !a.archived).map((a) => a.id));
  const categories = new Set(data.categories.filter((c) => !c.archived).map((c) => c.id));
  const people = new Set(data.people.map((p) => p.id));
  const exists = (ids: ReadonlySet<string>, id: string | null) => id === null || ids.has(id);
  const formValid =
    draft.type === 'friend'
      ? exists(accounts, draft.friendAccountId) && exists(people, draft.personId)
      : exists(accounts, draft.accountId) &&
        (draft.type === 'transfer'
          ? exists(accounts, draft.toAccountId)
          : !!draft.splitParts || exists(categories, draft.categoryId));
  return (
    formValid &&
    draft.rows.every(
      (row) =>
        exists(accounts, row.accountId) &&
        (row.kind === 'friend'
          ? exists(people, row.personId)
          : row.type === 'transfer'
            ? exists(accounts, row.toAccountId)
            : exists(categories, row.categoryId))
    ) &&
    (!draft.splitParts || draft.splitParts.every((part) => exists(categories, part.categoryId)))
  );
}
