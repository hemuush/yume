import { memo, useCallback } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/Text';
import { PrimaryButton } from '@/components/PrimaryButton';
import { CategoryPicker } from '@/components/CategoryPicker';
import { styles } from '@/features/add/add.styles';
import { exprFromMinor } from '@/lib/padMath';
import { FriendFields } from '@/features/add/AddFields';
import { TransferAccounts, UsualChips } from '@/features/add/AddSections';
import { SplitCard } from '@/features/add/SplitCard';
import type { AddEntryModel } from '@/features/add/types/addEntryModel';
import type { ReactElement } from 'react';

/** What this section of the Add page reads from the model; it is drawn again only when one of them changes. */
export const FIELDS_KEYS = [
  'type',
  'people',
  'friendAccounts',
  'personId',
  'setPersonId',
  'friendSign',
  'setFriendSign',
  'friendAccountId',
  'setFriendAccountId',
  'setAddPersonVisible',
  'pickableAccounts',
  'accounts',
  'setAddAccountVisible',
  'effectiveAccountId',
  'toAccountId',
  'pickAccount',
  'setToAccountId',
  'splitParts',
  'amountMinor',
  'filteredCategories',
  'currency',
  'openSplit',
  'editing',
  'setSplitParts',
  'setError',
  'usual',
  'isLinked',
  'categoryId',
  'setCategoryId',
  'setExpr',
  'hasAmount',
  'setPadOpen',
  'setSearchFocused',
] as const satisfies readonly (keyof AddEntryModel)[];

// The grid of every category is drawn again only when its own inputs change, not for each digit typed above it.
const Picker = memo(CategoryPicker);

type Props = { model: Pick<AddEntryModel, (typeof FIELDS_KEYS)[number]> };
export function AddEntryFields({ model }: Props): ReactElement {
  const {
    type,
    people,
    friendAccounts,
    personId,
    setPersonId,
    friendSign,
    setFriendSign,
    friendAccountId,
    setFriendAccountId,
    setAddPersonVisible,
    pickableAccounts,
    accounts,
    setAddAccountVisible,
    effectiveAccountId,
    toAccountId,
    pickAccount,
    setToAccountId,
    splitParts,
    amountMinor,
    filteredCategories,
    currency,
    openSplit,
    editing,
    setSplitParts,
    setError,
    usual,
    isLinked,
    categoryId,
    setCategoryId,
    setExpr,
    hasAmount,
    setPadOpen,
    setSearchFocused,
  } = model;
  const onPickCategory = useCallback(
    (id: string) => {
      setCategoryId(id);
      // Amount typed: the pad folds away so the grid and Save have the room.
      if (hasAmount) setPadOpen(false);
    },
    [setCategoryId, setPadOpen, hasAmount]
  );

  return (
    <>
      {type === 'friend' ? (
        <View style={styles.fieldCard}>
          <FriendFields
            people={people}
            accounts={friendAccounts}
            personId={personId}
            setPersonId={setPersonId}
            friendSign={friendSign}
            setFriendSign={setFriendSign}
            friendAccountId={friendAccountId}
            setFriendAccountId={setFriendAccountId}
            onAddPerson={() => setAddPersonVisible(true)}
          />
        </View>
      ) : (
        <>
          {pickableAccounts.length === 0 && (
            // Nothing to record this against yet (previously only a "Pick an account" error on Save):
            // opens the same Add Account form Profile uses, right here.
            <View style={[styles.noteCard, styles.noAccountCard]}>
              <Text style={styles.noAccountTitle}>
                {accounts.length === 0 ? 'Add your first account' : 'Add a spendable account'}
              </Text>
              <Text style={styles.noAccountText}>
                {accounts.length === 0
                  ? 'A bank, cash or wallet account.'
                  : 'Savings only take transfers. Add a bank, cash or wallet account.'}
              </Text>
              <PrimaryButton
                title="Add an account"
                onPress={() => setAddAccountVisible(true)}
                style={styles.noAccountBtn}
              />
            </View>
          )}

          {type === 'transfer' ? (
            <View style={styles.fieldCard}>
              <TransferAccounts
                fromOptions={pickableAccounts}
                accounts={accounts}
                fromId={effectiveAccountId}
                toId={toAccountId}
                onPickFrom={pickAccount}
                onPickTo={setToAccountId}
              />
            </View>
          ) : splitParts ? (
            <SplitCard
              parts={splitParts}
              totalMinor={amountMinor}
              categories={filteredCategories}
              currency={currency}
              onEdit={openSplit}
              onRemove={
                editing
                  ? undefined
                  : () => {
                      setSplitParts(null);
                      setError(null);
                    }
              }
            />
          ) : (
            <View style={styles.section}>
              {usual.length > 0 && !isLinked && (
                <UsualChips
                  usual={usual}
                  categoryId={categoryId}
                  amountMinor={amountMinor}
                  accountId={effectiveAccountId}
                  onPick={(u) => {
                    setCategoryId(u.categoryId);
                    setExpr(exprFromMinor(u.amountMinor));
                    pickAccount(u.accountId);
                  }}
                />
              )}
              <View style={styles.fieldCard}>
                <Picker
                  categories={filteredCategories}
                  selectedId={categoryId}
                  onSelect={onPickCategory}
                  variant="medal"
                  compact
                  searchable
                  onSearchFocusChange={setSearchFocused}
                />
              </View>
            </View>
          )}
        </>
      )}
    </>
  );
}
