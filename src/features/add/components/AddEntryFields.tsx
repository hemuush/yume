import { View } from 'react-native';
import { Text } from '@/components/Text';
import { PrimaryButton } from '@/components/PrimaryButton';
import { CategoryPicker } from '@/components/CategoryPicker';
import { StripCard } from '@/components/StripCard';
import { styles } from '@/features/add/add.styles';
import { Glass } from '@/components/Glass';
import { exprFromMinor } from '@/lib/padMath';
import { FriendFields } from '@/features/add/AddFields';
import { TransferAccounts, UsualChips } from '@/features/add/AddSections';
import { SplitCard } from '@/features/add/SplitCard';
import type { AddEntryModel } from '@/features/add/types/addEntryModel';
import type { ReactElement } from 'react';

type Props = {
  model: Pick<
    AddEntryModel,
    | 'type'
    | 'people'
    | 'friendAccounts'
    | 'personId'
    | 'setPersonId'
    | 'friendSign'
    | 'setFriendSign'
    | 'friendAccountId'
    | 'setFriendAccountId'
    | 'setAddPersonVisible'
    | 'pickableAccounts'
    | 'accent'
    | 'accounts'
    | 'setAddAccountVisible'
    | 'effectiveAccountId'
    | 'toAccountId'
    | 'pickAccount'
    | 'setToAccountId'
    | 'splitParts'
    | 'amountMinor'
    | 'filteredCategories'
    | 'currency'
    | 'openSplit'
    | 'editing'
    | 'setSplitParts'
    | 'setError'
    | 'usual'
    | 'isLinked'
    | 'categoryId'
    | 'setCategoryId'
    | 'setExpr'
    | 'expr'
    | 'setPadOpen'
    | 'setSearchFocused'
  >;
};
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
    accent,
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
    expr,
    setPadOpen,
    setSearchFocused,
  } = model;

  return (
    <>
      {type === 'friend' ? (
        <Glass radius={24} style={styles.fieldCard}>
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
        </Glass>
      ) : (
        <>
          {pickableAccounts.length === 0 && (
            // Nothing to record this against yet (previously only a "Pick an account" error on Save):
            // opens the same Add Account form Profile uses, right here.
            <StripCard tone={accent} style={[styles.noAccountCard, styles.noteCard]}>
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
            </StripCard>
          )}

          {type === 'transfer' ? (
            <Glass radius={24} style={styles.fieldCard}>
              <TransferAccounts
                fromOptions={pickableAccounts}
                accounts={accounts}
                fromId={effectiveAccountId}
                toId={toAccountId}
                onPickFrom={pickAccount}
                onPickTo={setToAccountId}
              />
            </Glass>
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
              <Glass radius={24} style={styles.fieldCard}>
                <CategoryPicker
                  categories={filteredCategories}
                  selectedId={categoryId}
                  onSelect={(id) => {
                    setCategoryId(id);
                    // Amount typed: the pad folds away so the grid and Save have the room.
                    if (expr !== '') setPadOpen(false);
                  }}
                  variant="medal"
                  searchable
                  minColumnWidth={80}
                  onSearchFocusChange={setSearchFocused}
                />
              </Glass>
            </View>
          )}
        </>
      )}
    </>
  );
}
