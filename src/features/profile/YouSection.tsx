import { useCallback, useState } from 'react';
import { View, Pressable, Animated, ActivityIndicator } from 'react-native';
import { Text } from '@/components/Text';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import ReanimatedAnimated from 'react-native-reanimated';
import { PANEL_ENTER, ROW_EXIT } from '@/lib/animation';
import { listAccounts, countTransactions } from '@/db/ledger';
import { listLoans } from '@/db/loans';
import { trackedBalanceParts, TrackedBalanceParts } from '@/db/reports';
import { listPeople } from '@/db/people';
import { getDefaultCurrency } from '@/db/settings';
import { roundedMinor } from '@/lib/round';
import { Account } from '@/types';
import { EmptyState } from '@/components/EmptyState';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Amount } from '@/components/Amount';
import { AddButton } from '@/components/AddButton';
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';
import { usePrivacy } from '@/theme/PrivacyContext';
import { useFadeIn } from '@/lib/useFadeIn';
import { useScreenLoad } from '@/lib/useScreenLoad';
import { usePressScale } from '@/lib/usePressScale';
import { accountBadgeColor, accountIcon } from '@/lib/account';
import { GainPill } from '@/features/investments/GainPill';
import { HomeSection } from '@/features/home/HomeSection';
import { homeStyles as h } from '@/features/home/homeStyles';
import { styles } from './profile.styles';
import { trackedSumLines, groupAccountsByType } from './trackedSum';
import { CashHero } from './CashHero';
import { TrackedCard } from './TrackedCard';
import { LinkTiles } from './LinkTiles';
import { AddAccountModal } from './AddAccountModal';
import { AccountDetailModal } from './AccountDetailModal';
import { withPressed } from '@/lib/pressed';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const ACCOUNT_TYPE_LABEL: Record<Account['type'], string> = {
  bank: 'Bank',
  cash: 'Cash',
  wallet: 'Wallet',
  savings: 'Savings',
  credit_card: 'Credit card',
};

/**
 * "You": what is in your accounts first, the tracked balance as one line that
 * opens to the sum it is, tiles that open Entries, Loans and Friends, and
 * your accounts grouped by type. Budgets, goals, recurring, What-if and
 * Suu's Garden live on Plan; one row here points there. Settings is the
 * other tab of the Profile screen.
 */
export function YouSection() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [archivedAccounts, setArchivedAccounts] = useState<Account[]>([]);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [detailAccount, setDetailAccount] = useState<Account | null>(null);
  const [txCount, setTxCount] = useState(0);
  const [activeLoanCount, setActiveLoanCount] = useState(0);
  const [peopleCount, setPeopleCount] = useState(0);
  const [parts, setParts] = useState<TrackedBalanceParts>({
    accountsMinor: 0,
    loansMinor: 0,
    peopleMinor: 0,
  });
  const [defaultCurrency, setDefaultCurrencyState] = useState('INR');
  const [hasOtherCurrency, setHasOtherCurrency] = useState(false);
  const [hasLoans, setHasLoans] = useState(false);
  const [hasUntrackedAssetLoan, setHasUntrackedAssetLoan] = useState(false);
  const [addAccountVisible, setAddAccountVisible] = useState(false);
  const accountsFadeStyle = useFadeIn();

  const loadYou = useCallback(async () => {
    const [accs, allAccs, txCountNow, loans, people, currency] = await Promise.all([
      listAccounts(),
      listAccounts(true),
      // Only the count is shown — loading every row just to take .length
      // was the single heaviest query on this screen.
      countTransactions(),
      listLoans(),
      listPeople(),
      getDefaultCurrency(),
    ]);
    const openLoans = loans.filter((l) => l.status !== 'closed');
    setAccounts(accs);
    setArchivedAccounts(allAccs.filter((a) => a.archived));
    setTxCount(txCountNow);
    setPeopleCount(people.length);
    setActiveLoanCount(loans.filter((l) => l.status === 'active').length);
    setDefaultCurrencyState(currency);
    setHasOtherCurrency(accs.some((a) => a.currency !== currency));
    // The same three terms computeTrackedBalance adds up, kept apart so the
    // card can show them as a sum.
    setParts(trackedBalanceParts({ accounts: accs, loans, people, defaultCurrency: currency }));
    setHasLoans(openLoans.length > 0);
    setHasUntrackedAssetLoan(openLoans.some((l) => l.direction === 'borrowed' && !l.assetValueMinor));
  }, []);
  const { loaded, loadError, reload: load } = useScreenLoad(loadYou);

  // Every balance on this screen is shown as whole rupees. Each account row
  // rounds its own balance, and the accounts total (the sum's first line and
  // the card's footer) is the sum of those rounded rows, default-currency
  // accounts only, so the list always adds up to the number shown for it.
  const dispAccountBalance = (a: Account) => roundedMinor(a.currentBalanceMinor);
  const accountsShown = accounts
    .filter((a) => a.currency === defaultCurrency)
    .reduce((sum, a) => sum + dispAccountBalance(a), 0);
  const sum = trackedSumLines(parts, accountsShown);
  const groups = groupAccountsByType(accounts, defaultCurrency);

  // Every total that includes savings is hidden along with the savings rows,
  // otherwise subtracting the visible rows gives the savings back.
  const { hideAmounts } = usePrivacy();
  const masked = hideAmounts && accounts.some((a) => a.type === 'savings' && a.currency === defaultCurrency);
  const countedAccounts = accounts.filter((a) => a.currency === defaultCurrency).length;
  const otherCurrencyAccounts = accounts.length - countedAccounts;
  const heroSub = [
    `across ${countedAccounts} ${countedAccounts === 1 ? 'account' : 'accounts'}`,
    otherCurrencyAccounts > 0 ? `${otherCurrencyAccounts} in another currency` : null,
    masked ? 'savings hidden' : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const showLoans = hasLoans || sum.loansMinor !== 0;
  const showPeople = peopleCount > 0 || sum.peopleMinor !== 0;

  if (!loaded && !loadError) {
    // Not a full-screen gate — the shell's header, identity, and tab
    // control above this are already visible; this only fills the space
    // this section itself would otherwise occupy while it loads.
    return (
      <View style={{ paddingVertical: 40, alignItems: 'center' }}>
        <ActivityIndicator color={theme.colors.ink} />
      </View>
    );
  }

  return (
    <>
      {loadError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorTitle}>Couldn't load your data</Text>
          <Text style={styles.errorDetail}>{loadError}</Text>
        </View>
      )}

      {accounts.length > 0 && (
        <CashHero
          minor={sum.accountsMinor}
          label={hasOtherCurrency ? `In your accounts (${defaultCurrency} only)` : 'In your accounts'}
          sub={heroSub}
          masked={masked}
        />
      )}
      {(showLoans || showPeople) && (
        <TrackedCard
          totalMinor={sum.totalMinor}
          accountsMinor={sum.accountsMinor}
          loansMinor={sum.loansMinor}
          peopleMinor={sum.peopleMinor}
          accountsLabel={hasOtherCurrency ? `Your accounts (${defaultCurrency} only)` : 'Your accounts'}
          showLoans={showLoans}
          showPeople={showPeople}
          untrackedAssetLoan={hasUntrackedAssetLoan}
          hasLoans={hasLoans}
          masked={masked}
        />
      )}
      <LinkTiles
        entries={txCount}
        loans={activeLoanCount}
        friends={peopleCount}
        onEntries={() => router.navigate('/transactions')}
        onLoans={() => router.push('/loans')}
        onFriends={() => router.push('/people')}
      />

      <HomeSection
        title="Accounts"
        right={<AddButton onPress={() => setAddAccountVisible(true)} label="+ Account" />}
      >
        {accounts.length === 0 ? (
          <EmptyState title="No accounts yet" subtitle="Tap + Account to create one." />
        ) : (
          <Animated.View style={[h.card, accountsFadeStyle]}>
            {groups.map((group, gi) => (
              <View key={group.type}>
                {groups.length > 1 && (
                  <View style={[styles.groupHead, gi > 0 && h.divider]}>
                    <Text style={styles.groupLabel}>
                      {ACCOUNT_TYPE_LABEL[group.type as Account['type']] ?? group.type} ·{' '}
                      {group.accounts.length}
                    </Text>
                    {group.subtotalMinor != null && (
                      <Amount
                        minor={group.subtotalMinor}
                        sensitive={group.type === 'savings'}
                        style={styles.groupTotal}
                      />
                    )}
                  </View>
                )}
                {group.accounts.map((acc, i) => (
                  <AccountRow
                    key={acc.id}
                    account={acc}
                    minor={dispAccountBalance(acc)}
                    divider={i > 0}
                    onPress={setDetailAccount}
                  />
                ))}
              </View>
            ))}
          </Animated.View>
        )}

        {archivedAccounts.length > 0 && (
          <View style={[h.card, styles.archivedCard]}>
            <Pressable
              style={withPressed(h.row)}
              onPress={() => setArchivedOpen((v) => !v)}
              accessibilityRole="button"
              accessibilityState={{ expanded: archivedOpen }}
            >
              <View style={[h.iconTile, { backgroundColor: theme.colors.surfaceAlt }]}>
                <MaterialCommunityIcons name="archive-outline" size={17} color={theme.colors.ink} />
              </View>
              <View style={h.mid}>
                <Text style={h.title}>Archived accounts</Text>
                <Text style={h.sub}>
                  {archivedAccounts.length} account{archivedAccounts.length === 1 ? '' : 's'} ·{' '}
                  {archivedOpen ? 'tap to hide' : 'tap to show'}
                </Text>
              </View>
              <Feather
                name={archivedOpen ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={theme.colors.textMuted}
              />
            </Pressable>
            {archivedOpen && (
              <ReanimatedAnimated.View entering={PANEL_ENTER} exiting={ROW_EXIT}>
                {archivedAccounts.map((acc) => (
                  <AccountRow
                    key={acc.id}
                    account={acc}
                    minor={dispAccountBalance(acc)}
                    divider
                    archived
                    onPress={setDetailAccount}
                  />
                ))}
              </ReanimatedAnimated.View>
            )}
          </View>
        )}
      </HomeSection>

      {/* Budgets, goals, recurring, What-if and Suu's Garden live on Plan,
          each in a fuller screen, so Profile stays about you. This one row
          points there for anyone used to finding them on Profile. */}
      <Pressable
        onPress={() => router.navigate('/plan')}
        style={withPressed(styles.planLink)}
        accessibilityRole="button"
        accessibilityLabel="Budgets, goals and recurring are in Plan"
      >
        <View style={[styles.planLinkIcon, { backgroundColor: theme.colors.secondary }]}>
          <MaterialCommunityIcons name="view-grid-outline" size={16} color={theme.colors.ink} />
        </View>
        <Text style={styles.planLinkText}>Budgets, goals &amp; recurring are in Plan</Text>
        <Feather name="chevron-right" size={16} color={theme.colors.textMuted} />
      </Pressable>

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
    </>
  );
}

function AccountRow({
  account,
  minor,
  divider,
  archived,
  onPress,
}: {
  account: Account;
  minor: number;
  divider: boolean;
  archived?: boolean;
  onPress: (account: Account) => void;
}) {
  const { accent } = useAccent();
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.98);
  return (
    <AnimatedPressable
      style={[h.row, divider && h.divider, archived && styles.archivedDim, animatedStyle]}
      onPress={() => onPress(account)}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
    >
      <CategoryIcon name={accountIcon(account.type)} color={accountBadgeColor(account.type, accent)} />
      <View style={h.mid}>
        <Text style={h.title} numberOfLines={1}>
          {account.name}
        </Text>
        <Text style={h.sub} numberOfLines={1}>
          {account.investment ? 'Savings · tracked' : ACCOUNT_TYPE_LABEL[account.type]}
          {archived ? ' · archived' : ''}
        </Text>
      </View>
      {account.investment && !archived && <GainPill account={account} moneyOnly />}
      <Amount
        minor={minor}
        currency={account.currency}
        sensitive={account.type === 'savings'}
        style={[h.amount, !archived && account.currentBalanceMinor < 0 && h.expense]}
      />
    </AnimatedPressable>
  );
}
