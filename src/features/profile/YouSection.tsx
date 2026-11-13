import { ScreenLoadError } from '@/components/ScreenLoadError';
import { Appear } from '@/components/Appear';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useCallback, useMemo, useState } from 'react';
import { View, Pressable, ActivityIndicator } from 'react-native';
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
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';
import { usePrivacy } from '@/theme/PrivacyContext';
import { useScreenLoad } from '@/lib/useScreenLoad';
import { Section } from '@/components/Section';
import { styles } from './profile.styles';
import { trackedSumLines, groupAccountsByType } from './trackedSum';
import { CashHero } from './CashHero';
import { AccountTiles, tileOrder } from './AccountTiles';
import { TrackedCard } from './TrackedCard';
import { LinkTiles } from './LinkTiles';
import { AddAccountModal } from './AddAccountModal';
import { AccountDetailModal } from './AccountDetailModal';
import { withPressedTint } from '@/lib/pressed';

/**
 * "You": accounts first, tracked balance as one line opening to its sum, tiles for Entries, Loans and Friends,
 * accounts grouped by type. Budgets, goals, recurring, What-if and Garden live on Plan (one row points there).
 */
export function YouSection() {
  const { accent } = useAccent();
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
  const { loaded, hasData, loadError, reload: load } = useScreenLoad(loadYou);

  // Balances are whole rupees: each account row rounds its own, and the accounts total (sum's first line and
  // card footer) sums those rounded rows, default-currency only, so the list always adds up.
  const dispAccountBalance = (a: Account) => roundedMinor(a.currentBalanceMinor);
  const accountsShown = accounts
    .filter((a) => a.currency === defaultCurrency)
    .reduce((sum, a) => sum + dispAccountBalance(a), 0);
  const sum = trackedSumLines(parts, accountsShown);
  const tiles = useMemo(
    () => tileOrder(groupAccountsByType(accounts, defaultCurrency).flatMap((g) => g.accounts)),
    [accounts, defaultCurrency]
  );

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

  const showTracked = showLoans || showPeople;
  const trackedCard = (embedded: boolean) => (
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
      currency={defaultCurrency}
      embedded={embedded}
    />
  );

  if (!hasData && loadError)
    return <ScreenLoadError title="Profile" message={loadError} onRetry={() => void load()} embedded />;

  if (!loaded && !loadError) {
    // Not a full-screen gate: the shell's header, identity and tabs are already visible; this only fills
    // this section's own space while it loads.
    return (
      <View style={{ paddingVertical: 40, alignItems: 'center' }}>
        <ActivityIndicator color={theme.colors.ink} />
      </View>
    );
  }

  return (
    <>
      {loadError && (
        <Appear style={styles.errorBanner}>
          <Text style={styles.errorTitle}>Couldn’t load your data</Text>
          <Text style={styles.errorDetail}>{loadError}</Text>
          <PrimaryButton title="Retry" compact variant="secondary" onPress={() => void load()} />
        </Appear>
      )}

      {accounts.length > 0 ? (
        <CashHero
          minor={sum.accountsMinor}
          label={hasOtherCurrency ? `In your accounts (${defaultCurrency} only)` : 'In your accounts'}
          sub={heroSub}
          masked={masked}
        >
          {showTracked && trackedCard(true)}
          <LinkTiles
            embedded
            entries={txCount}
            loans={activeLoanCount}
            friends={peopleCount}
            onEntries={() => router.navigate('/transactions')}
            onLoans={() => router.push('/loans')}
            onFriends={() => router.push('/people')}
          />
        </CashHero>
      ) : (
        <>
          {showTracked && trackedCard(false)}
          <LinkTiles
            entries={txCount}
            loans={activeLoanCount}
            friends={peopleCount}
            onEntries={() => router.navigate('/transactions')}
            onLoans={() => router.push('/loans')}
            onFriends={() => router.push('/people')}
          />
        </>
      )}

      <Section
        compact
        title="Accounts"
        right={
          <Pressable
            onPress={() => setAddAccountVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Add an account"
            style={withPressedTint(accent, styles.addLink)}
          >
            <Feather name="plus" size={14} color={theme.colors.link} />
            <Text style={styles.addLinkText}>Add</Text>
          </Pressable>
        }
      >
        {accounts.length === 0 ? (
          <EmptyState
            title="Add your first account"
            subtitle="Track a bank account, cash or wallet. Use its current balance as your starting balance."
          >
            <PrimaryButton title="Add an account" onPress={() => setAddAccountVisible(true)} />
          </EmptyState>
        ) : (
          <AccountTiles accounts={tiles} onPress={setDetailAccount} />
        )}

        {archivedAccounts.length > 0 && (
          <View style={styles.archivedWrap}>
            <Pressable
              style={withPressedTint(accent, styles.archivedRow)}
              onPress={() => setArchivedOpen((v) => !v)}
              accessibilityRole="button"
              accessibilityState={{ expanded: archivedOpen }}
              accessibilityLabel={`Archived accounts, ${archivedAccounts.length}. ${archivedOpen ? 'Hide' : 'Show'}`}
            >
              <MaterialCommunityIcons name="archive-outline" size={15} color={theme.colors.textMuted} />
              <Text style={styles.archivedLabel}>Archived accounts</Text>
              <Text style={styles.archivedSub}>
                {archivedAccounts.length} account{archivedAccounts.length === 1 ? '' : 's'} ·{' '}
                {archivedOpen ? 'tap to hide' : 'tap to show'}
              </Text>
              <Feather
                name={archivedOpen ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={theme.colors.textMuted}
              />
            </Pressable>
            {archivedOpen && (
              <ReanimatedAnimated.View entering={PANEL_ENTER} exiting={ROW_EXIT}>
                <AccountTiles accounts={archivedAccounts} archived onPress={setDetailAccount} />
              </ReanimatedAnimated.View>
            )}
          </View>
        )}
      </Section>

      {/* Budgets, goals, recurring, What-if and Suu’s Garden live on Plan,
          each in a fuller screen, so Profile stays about you. This one row
          points there for anyone used to finding them on Profile. */}
      <Pressable
        onPress={() => router.navigate('/plan')}
        style={withPressedTint(accent, styles.planLink)}
        accessibilityRole="button"
        accessibilityLabel="Budgets, goals and recurring are in Plan"
      >
        <Text style={styles.planLinkText}>Budgets, goals &amp; recurring are in Plan</Text>
        <Feather name="chevron-right" size={14} color={theme.colors.link} />
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
