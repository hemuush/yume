import { useCallback, useState } from 'react';
import { View, Pressable, Animated, ActivityIndicator } from 'react-native';
import { Text } from '@/components/Text';
import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { listAccounts, countTransactions } from '@/db/ledger';
import { listLoans } from '@/db/loans';
import { computeTrackedBalance } from '@/db/reports';
import { listPeople } from '@/db/people';
import { getDefaultCurrency } from '@/db/settings';
import { formatMoney } from '@/lib/money';
import { roundedMinor } from '@/lib/round';
import { Account } from '@/types';
import { EmptyState } from '@/components/EmptyState';
import { FlatIconBadge } from '@/components/FlatIconBadge';
import { SettingsRowIcon } from '@/components/SettingsRowIcon';
import { Amount } from '@/components/Amount';
import { AddButton } from '@/components/AddButton';
import { SectionLabel } from '@/components/SectionLabel';
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';
import { NeoTile } from '@/components/NeoTile';
import { useFadeIn } from '@/lib/useFadeIn';
import { useScreenLoad } from '@/lib/useScreenLoad';
import { styles } from './profile.styles';
import { accountIcon } from '@/lib/account';
import { AddAccountModal } from './AddAccountModal';
import { AccountDetailModal } from './AccountDetailModal';

const AnimatedAccountPressable = Animated.createAnimatedComponent(Pressable);

/**
 * "You" — your tracked balance, a few stats, and your accounts. Budgets,
 * savings goals, recurring rules, What-if and Suu's Garden used to be
 * previewed here as well; they now live on the Plan tab, each in its own
 * fuller screen, and a single row here points there. Settings follows
 * below this section on the Profile screen.
 */
export function YouSection() {
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
  const accountsFadeStyle = useFadeIn([accounts]);

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
    setAccounts(accs);
    setArchivedAccounts(allAccs.filter((a) => a.archived));
    setTxCount(txCountNow);
    setPeopleCount(people.length);
    setActiveLoanCount(loans.filter((l) => l.status === 'active').length);
    setDefaultCurrencyState(currency);
    setHasOtherCurrency(accs.some((a) => a.currency !== currency));
    // Shared with Home so the two screens can never show a different
    // headline number — a not-yet-closed loan with a tracked asset value
    // nets to its real equity here, a defaulted loan still counts, and
    // only a fully 'closed' loan drops out.
    setNetWorth(computeTrackedBalance({ accounts: accs, loans, people, defaultCurrency: currency }));
    setHasUntrackedAssetLoan(
      loans.some((l) => l.status !== 'closed' && l.direction === 'borrowed' && !l.assetValueMinor)
    );
  }, []);
  const { loaded, loadError, reload: load } = useScreenLoad(loadYou);

  // Every balance on this screen is shown as whole rupees. Each account row
  // rounds its own balance, and the ACCOUNT BALANCE stat is the sum of those
  // rounded rows (default-currency accounts only) so the list always adds up
  // to the number shown above it.
  const dispAccountBalance = (a: Account) => roundedMinor(a.currentBalanceMinor);
  const totalBalance = accounts
    .filter((a) => a.currency === defaultCurrency)
    .reduce((sum, a) => sum + dispAccountBalance(a), 0);

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
        <Stat value={formatMoney(totalBalance)} label="ACCOUNT BALANCE" icon="wallet-outline" />
        <Stat value={String(txCount)} label="ENTRIES" icon="format-list-bulleted" />
        <Stat value={String(activeLoanCount)} label="ACTIVE LOANS" icon="bank-outline" />
        <Stat value={String(peopleCount)} label="PEOPLE" icon="account-group-outline" />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Accounts</Text>
        <AddButton onPress={() => setAddAccountVisible(true)} label="+ Account" />
      </View>
      {accounts.length === 0 ? (
        <EmptyState title="No accounts yet" subtitle="Tap + Account to create one." />
      ) : (
        accounts.map((acc) => (
          <Animated.View key={acc.id} style={[styles.accountCardWrap, accountsFadeStyle]}>
            <NeoTile style={styles.accountCard}>
              <AnimatedAccountPressable onPress={() => setDetailAccount(acc)} style={styles.accountCardInner}>
                <FlatIconBadge name={accountIcon(acc.type)} />
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
        ))
      )}

      {/* Budgets, goals, recurring, What-if and Suu's Garden used to be
          previewed here too — they now live on Plan, each in a fuller screen
          than this preview was, so Profile stays about you. This one row
          points there for anyone used to finding them on Profile. */}
      <Pressable
        onPress={() => router.navigate('/plan')}
        style={styles.gardenLink}
        accessibilityRole="button"
        accessibilityLabel="Budgets, goals and recurring are in Plan"
      >
        <SettingsRowIcon name="view-grid-outline" backgroundColor={theme.colors.secondary} />
        <Text style={styles.gardenLinkText}>Budgets, goals &amp; recurring are in Plan</Text>
        <Feather name="chevron-right" size={16} color={theme.colors.textMuted} />
      </Pressable>

      {archivedAccounts.length > 0 && (
        <>
          <SectionLabel color={theme.colors.textMuted} tint={theme.colors.surfaceAlt}>
            ARCHIVED ACCOUNTS
          </SectionLabel>
          {archivedAccounts.map((acc) => (
            <View key={acc.id} style={[styles.accountCardWrap, styles.archivedCard]}>
              <NeoTile style={styles.accountCard}>
                <Pressable onPress={() => setDetailAccount(acc)} style={styles.accountCardInner}>
                  <FlatIconBadge name={accountIcon(acc.type)} />
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

function Stat({ value, label, icon }: { value: string; label: string; icon: string }) {
  const { accent, onAccent } = useAccent();
  return (
    <NeoTile style={styles.statCell}>
      <SettingsRowIcon name={icon} backgroundColor={accent} iconColor={onAccent} />
      <View style={styles.statText}>
        <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </NeoTile>
  );
}
