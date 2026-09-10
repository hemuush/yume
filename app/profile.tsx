import { useCallback, useState } from 'react';
import { View, Text, Pressable, TextInput, Animated, Alert } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useFocusEffect } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listAccounts, listTransactions } from '@/db/ledger';
import { listLoans } from '@/db/loans';
import { computeTrackedBalance } from '@/db/reports';
import { listPeople } from '@/db/people';
import { getUserName, setUserName, getMemberSinceYear, getDefaultCurrency } from '@/db/settings';
import { formatMoney } from '@/lib/money';
import { roundedMinor } from '@/lib/round';
import { Account } from '@/types';
import { AppHeader, HeaderPrivacyToggle } from '@/components/AppHeader';
import { EmptyState } from '@/components/EmptyState';
import { FlatIconBadge } from '@/components/FlatIconBadge';
import { Amount } from '@/components/Amount';
import { AddButton } from '@/components/AddButton';
import { SectionLabel } from '@/components/SectionLabel';
import { theme, ID_PALETTE } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';
import { NeoTile } from '@/components/NeoTile';
import { useFadeIn } from '@/lib/useFadeIn';
import { styles } from '@/features/profile/profile.styles';
import { ACCOUNT_ICON } from '@/features/profile/profile.constants';
import { AddAccountModal } from '@/features/profile/AddAccountModal';
import { AccountDetailModal } from '@/features/profile/AccountDetailModal';

/**
 * Everything about "you" in one place — the destination behind the profile
 * button that now sits on every screen's header. Accounts live here now too
 * (they were previously their own bottom tab): they're your money, and your
 * money belongs with your identity, not a sixth flat tab competing with
 * Home/Activity/Loans/Reports for attention.
 */
export default function ProfileScreen() {
  const { accent, onAccent } = useAccent();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [memberSince, setMemberSince] = useState<number | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [archivedAccounts, setArchivedAccounts] = useState<Account[]>([]);
  const [detailAccount, setDetailAccount] = useState<Account | null>(null);
  const [txCount, setTxCount] = useState(0);
  const [activeLoanCount, setActiveLoanCount] = useState(0);
  const [peopleCount, setPeopleCount] = useState(0);
  const [netWorth, setNetWorth] = useState(0);
  const [defaultCurrency, setDefaultCurrencyState] = useState('INR');
  const [hasOtherCurrency, setHasOtherCurrency] = useState(false);
  const [hasUntrackedAssetLoan, setHasUntrackedAssetLoan] = useState(false);
  const [addAccountVisible, setAddAccountVisible] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const accountsFadeStyle = useFadeIn([accounts]);

  const load = useCallback(async () => {
    try {
      const [accs, allAccs, txs, loans, people, userName, since, currency] = await Promise.all([
        listAccounts(),
        listAccounts(true),
        listTransactions({ limit: 100000 }),
        listLoans(),
        listPeople(),
        getUserName(),
        getMemberSinceYear(),
        getDefaultCurrency(),
      ]);
      setName(userName);
      setMemberSince(since);
      setAccounts(accs);
      setArchivedAccounts(allAccs.filter((a) => a.archived));
      setTxCount(txs.length);
      setPeopleCount(people.length);

      setActiveLoanCount(loans.filter((l) => l.status === 'active').length);
      setDefaultCurrencyState(currency);
      setHasOtherCurrency(accs.some((a) => a.currency !== currency));
      // Shared with Home so the two screens can never show a different
      // headline number — a not-yet-closed loan with a tracked asset value
      // nets to its real equity here, a defaulted loan still counts, and
      // only a fully 'closed' loan drops out. ("ACTIVE LOANS" above is a
      // status count and deliberately stays narrower.)
      setNetWorth(computeTrackedBalance({ accounts: accs, loans, people, defaultCurrency: currency }));
      // Only worth the caveat when it's actually still true for at least one
      // loan — once every borrowed loan either has no asset behind it (a
      // personal loan, a credit card) or has a tracked value, the blanket
      // "assets aren't included" warning stops being accurate.
      setHasUntrackedAssetLoan(
        loans.some((l) => l.status !== 'closed' && l.direction === 'borrowed' && !l.assetValueMinor)
      );
      setLoadError(null);
    } catch (e: any) {
      // Previously any single failure here (e.g. a bad query) silently left
      // every field at its zero/empty default with no indication anything
      // had gone wrong — this surfaces it instead.
      setLoadError(String(e?.message ?? e));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const saveName = async () => {
    try {
      await setUserName(draft);
      setName(draft.trim() || null);
      setEditing(false);
    } catch (e: any) {
      Alert.alert('Could not save name', String(e?.message ?? e));
    }
  };

  // Every balance on this screen is shown as whole rupees. Each account row
  // rounds its own balance, and the ACCOUNT BALANCE stat is the sum of those
  // rounded rows (default-currency accounts only) so the list always adds up
  // to the number shown above it.
  const dispAccountBalance = (a: Account) => roundedMinor(a.currentBalanceMinor);
  const totalBalance = accounts
    .filter((a) => a.currency === defaultCurrency)
    .reduce((sum, a) => sum + dispAccountBalance(a), 0);

  return (
    <View style={styles.container}>
      <AppHeader title="Profile" showBack right={<HeaderPrivacyToggle />} />

      <KeyboardAwareScrollView
        contentContainerStyle={{ paddingBottom: 110 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
        bottomOffset={20}
      >
        {loadError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorTitle}>Couldn't load your data</Text>
            <Text style={styles.errorDetail}>{loadError}</Text>
          </View>
        )}
        <View style={styles.identity}>
          <View style={[styles.avatar, { backgroundColor: accent }]}>
            <Text style={[styles.avatarInitial, { color: onAccent }]}>
              {(name?.trim().charAt(0) || 'Y').toUpperCase()}
            </Text>
          </View>

          {editing ? (
            <View style={styles.nameEditRow}>
              <TextInput
                style={styles.nameInput}
                value={draft}
                onChangeText={setDraft}
                placeholder="Your name"
                placeholderTextColor={theme.colors.textMuted}
                maxLength={40}
                autoCapitalize="words"
                autoFocus
                returnKeyType="done"
                onSubmitEditing={saveName}
              />
              <Pressable onPress={saveName} hitSlop={10} style={styles.nameSave}>
                <Feather name="check" size={18} color={theme.colors.ink} />
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={styles.nameRow}
              onPress={() => {
                setDraft(name ?? '');
                setEditing(true);
              }}
            >
              <Text style={styles.name} numberOfLines={1}>
                {name || 'Add your name'}
              </Text>
              <Feather name="edit-2" size={14} color={theme.colors.textMuted} />
            </Pressable>
          )}

          <Text style={styles.memberSince}>Member since {memberSince ?? new Date().getFullYear()}</Text>
        </View>

        <NeoTile style={styles.netWorthCard}>
          <Text style={styles.netWorthLabel}>TRACKED BALANCE</Text>
          <Text style={styles.netWorthValue} numberOfLines={1} adjustsFontSizeToFit>
            {formatMoney(roundedMinor(netWorth))}
          </Text>
          <Text style={styles.netWorthHint}>
            Cash + loans + people{hasOtherCurrency ? ' · default-currency accounts only' : ''}.
            {hasUntrackedAssetLoan
              ? " A loan's own asset (a home, a vehicle) isn't included unless you record its value on that loan — until then this can run negative for a completely normal loan."
              : ' Loans with a tracked asset value count their real equity here, not just the debt.'}
          </Text>
        </NeoTile>

        <View style={styles.statsGrid}>
          <Stat value={formatMoney(totalBalance)} label="ACCOUNT BALANCE" color={theme.colors.idTeal} />
          <Stat value={String(txCount)} label="ENTRIES" color={theme.colors.idSage} />
          <Stat value={String(activeLoanCount)} label="ACTIVE LOANS" color={theme.colors.idGold} />
          <Stat value={String(peopleCount)} label="PEOPLE" color={theme.colors.idCoral} />
        </View>

        <View style={styles.sectionHeader}>
          <SectionLabel color={theme.colors.secondary} tint={theme.colors.secondaryTint}>
            ACCOUNTS
          </SectionLabel>
          <AddButton onPress={() => setAddAccountVisible(true)} label="+ Account" />
        </View>
        {accounts.length === 0 ? (
          <EmptyState title="No accounts yet" subtitle="Tap + Account to create one." />
        ) : (
          accounts.map((acc, i) => {
            const flat = ID_PALETTE[i % ID_PALETTE.length];
            return (
              <Animated.View key={acc.id} style={[styles.accountCardWrap, accountsFadeStyle]}>
                <NeoTile backgroundColor={flat} style={styles.accountCard}>
                  <AnimatedAccountPressable
                    onPress={() => setDetailAccount(acc)}
                    style={styles.accountCardInner}
                  >
                    <FlatIconBadge name={ACCOUNT_ICON[acc.type] ?? 'credit-card'} />
                    <View style={{ flex: 1, marginLeft: 14 }}>
                      <Text style={styles.accountName}>{acc.name}</Text>
                      <Text style={styles.accountType}>{acc.type.replace('_', ' ')}</Text>
                    </View>
                    <Amount
                      minor={dispAccountBalance(acc)}
                      currency={acc.currency}
                      sensitive={acc.type === 'savings'}
                      style={[styles.accountBalance, acc.currentBalanceMinor < 0 && styles.negative]}
                    />
                  </AnimatedAccountPressable>
                </NeoTile>
              </Animated.View>
            );
          })
        )}

        {archivedAccounts.length > 0 && (
          <>
            <SectionLabel color={theme.colors.textMuted} tint={theme.colors.surfaceAlt}>
              ARCHIVED ACCOUNTS
            </SectionLabel>
            {archivedAccounts.map((acc, i) => (
              <View key={acc.id} style={[styles.accountCardWrap, styles.archivedCard]}>
                <NeoTile backgroundColor={ID_PALETTE[i % ID_PALETTE.length]} style={styles.accountCard}>
                  <Pressable onPress={() => setDetailAccount(acc)} style={styles.accountCardInner}>
                    <FlatIconBadge name={ACCOUNT_ICON[acc.type] ?? 'credit-card'} />
                    <View style={{ flex: 1, marginLeft: 14 }}>
                      <Text style={styles.accountName}>{acc.name}</Text>
                      <Text style={styles.accountType}>{acc.type.replace('_', ' ')} · archived</Text>
                    </View>
                    <Amount
                      minor={dispAccountBalance(acc)}
                      currency={acc.currency}
                      sensitive={acc.type === 'savings'}
                      style={styles.accountBalance}
                    />
                  </Pressable>
                </NeoTile>
              </View>
            ))}
          </>
        )}
      </KeyboardAwareScrollView>

      <AddAccountModal
        visible={addAccountVisible}
        onClose={() => setAddAccountVisible(false)}
        onCreated={async () => {
          setAddAccountVisible(false);
          await load();
        }}
      />

      <AccountDetailModal
        account={detailAccount}
        onClose={() => setDetailAccount(null)}
        onChanged={async () => {
          setDetailAccount(null);
          await load();
        }}
      />
    </View>
  );
}

const AnimatedAccountPressable = Animated.createAnimatedComponent(Pressable);

function Stat({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <NeoTile backgroundColor={color} style={styles.statCell}>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </NeoTile>
  );
}
