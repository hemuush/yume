import { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ReanimatedAnimated from 'react-native-reanimated';
import { Text } from '@/components/Text';
import { Glass } from '@/components/Glass';
import { AddButton } from '@/components/AddButton';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SegmentedControl } from '@/components/SegmentedControl';
import { SettingsRow } from '@/components/SettingsRow';
import { ScreenLoadError } from '@/components/ScreenLoadError';
import { Section } from '@/components/Section';
import { cardSurface } from '@/components/CardSurface';
import { screenStyles as h, SCREEN } from '@/components/screenStyles';
import { SkyHeader } from '@/features/home/SkyHeader';
import { HomeWallpaper } from '@/features/home/HomeWallpaper';
import { AccountSummarySheet } from '@/features/home/AccountSummarySheet';
import { AccountDetailModal } from '@/features/profile/AccountDetailModal';
import { AddAccountModal } from '@/features/profile/AddAccountModal';
import { RuleModal } from '@/features/recurring/RuleModal';
import { ruleCadenceLabel } from '@/features/recurring/recurring.helpers';
import { HoldingRow } from '@/features/investments/HoldingRow';
import { InvestmentsHero, StartTracking } from '@/features/investments/InvestmentsHero';
import { SplitCard } from '@/features/investments/SplitCard';
import { PortfolioChart } from '@/features/investments/PortfolioChart';
import { HoldingPickerSheet } from '@/features/investments/HoldingPickerSheet';
import { UpdateValuesSheet } from '@/features/investments/UpdateValuesSheet';
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';
import { usePrivacy } from '@/theme/PrivacyContext';
import { useCollapsingHeader } from '@/lib/useCollapsingHeader';
import { useScreenLoad } from '@/lib/useScreenLoad';
import { toLocalIsoDate, addMonthsToIsoDate } from '@/lib/date';
import { formatMaskableMoney } from '@/lib/money';
import { weekdayDayMonth } from '@/lib/dateLabels';
import { investHref, withdrawHref } from '@/lib/investRoutes';
import { CURRENT_PERIOD } from '@/lib/period';
import {
  annualisedReturn,
  buildPortfolio,
  buildSeries,
  monthlySipTotal,
  seriesSince,
  sipsOf,
  splitOf,
  type Holding,
  type Sip,
} from '@/lib/portfolio';
import { getDefaultCurrency } from '@/db/settings';
import { listAccounts, listCategories } from '@/db/ledger';
import { listRecurringRules } from '@/db/recurring';
import { listInvestmentHistory } from '@/db/investmentHistory';
import type { Account, Category, RecurringRule } from '@/types';
import type { InvestmentFlow, InvestmentValuation } from '@/db/investmentHistory';

type Range = '6m' | '1y' | 'all';
const RANGE_MONTHS: Record<Range, number | null> = { '6m': 6, '1y': 12, all: null };

/**
 * Investments as one page: what they are worth, the gain and the yearly rate, the trend, where the money sits,
 * each holding, and the SIPs going in. Reached from Plan and from Profile. Values are the ones you enter, so
 * each holding shows how old its value is.
 */
export default function InvestmentsScreen() {
  const insets = useSafeAreaInsets();
  const { collapse, headerHeight, scrollHandler, scrollRef } = useCollapsingHeader();
  const { accent, secondary } = useAccent();
  const { hideAmounts } = usePrivacy();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [rules, setRules] = useState<RecurringRule[]>([]);
  const [currency, setCurrency] = useState('INR');
  const [history, setHistory] = useState<{ flows: InvestmentFlow[]; valuations: InvestmentValuation[] }>({
    flows: [],
    valuations: [],
  });
  const [range, setRange] = useState<Range>('1y');
  const [summary, setSummary] = useState<Account | null>(null);
  const [editing, setEditing] = useState<Account | null>(null);
  const [adding, setAdding] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [picking, setPicking] = useState<'invest' | 'sip' | null>(null);
  const [rule, setRule] = useState<{ editing: RecurringRule | null; holding: Account | null } | null>(null);
  const today = toLocalIsoDate(new Date());

  const load = useCallback(async () => {
    const [cur, accs, cats, hist, rs] = await Promise.all([
      getDefaultCurrency(),
      listAccounts(),
      listCategories(true),
      listInvestmentHistory(),
      listRecurringRules(),
    ]);
    setCurrency(cur);
    setAccounts(accs);
    setCategories(cats);
    setHistory(hist);
    setRules(rs);
  }, []);
  const { loaded, hasData, loadError, reload } = useScreenLoad(load);

  const portfolio = useMemo(() => buildPortfolio(accounts, currency, today), [accounts, currency, today]);
  const rate = useMemo(() => annualisedReturn(portfolio, history.flows, today), [portfolio, history, today]);
  const series = useMemo(() => buildSeries(portfolio, history, today), [portfolio, history, today]);
  const shown = useMemo(() => seriesSince(series, RANGE_MONTHS[range], today), [series, range, today]);
  const split = useMemo(() => splitOf(portfolio.holdings), [portfolio]);
  const sips = useMemo(() => sipsOf(rules, accounts), [rules, accounts]);
  const sipMonthly = useMemo(() => monthlySipTotal(sips, accounts, currency), [sips, accounts, currency]);
  const money = (minor: number, cur = currency) =>
    formatMaskableMoney(minor, { currency: cur, masked: hideAmounts });

  if (loadError && !hasData) {
    return <ScreenLoadError title="Investments" message={loadError} onRetry={() => void reload()} />;
  }

  const all = [...portfolio.holdings, ...portfolio.otherCurrency];
  const none = loaded && all.length === 0;
  const invest = (holding: Holding) => router.push(investHref(holding.account));
  const startSip = (holding: Account) => setRule({ editing: null, holding });
  const pick = (holding: Holding) => {
    const mode = picking;
    setPicking(null);
    if (mode === 'invest') invest(holding);
    else if (mode === 'sip') startSip(holding.account);
  };
  const choose = (mode: 'invest' | 'sip') => {
    if (portfolio.holdings.length === 1) {
      if (mode === 'invest') invest(portfolio.holdings[0]);
      else startSip(portfolio.holdings[0].account);
    } else setPicking(mode);
  };
  const prefill = rule?.holding
    ? {
        type: 'transfer' as const,
        accountId: rule.holding.investment?.fundingAccountId ?? '',
        toAccountId: rule.holding.id,
        categoryId: null,
        amountMinor: 0,
        note: 'SIP',
        nextRunDate: addMonthsToIsoDate(today, 1),
      }
    : undefined;

  const sipRow = (sip: Sip, i: number) => (
    <SettingsRow
      key={sip.rule.id}
      icon="repeat"
      round
      label={sip.holdingName}
      sub={`${ruleCadenceLabel(sip.rule)} · from ${sip.fromName}${
        sip.active ? ` · next ${weekdayDayMonth(sip.rule.nextRunDate)}` : ' · paused'
      }`}
      subColor={sip.active ? undefined : theme.colors.warnInk}
      value={money(sip.rule.amountMinor)}
      onPress={() => setRule({ editing: sip.rule, holding: null })}
      divider={i > 0}
    />
  );

  return (
    <View style={styles.container}>
      <HomeWallpaper accent={accent} secondary={secondary} />
      <ReanimatedAnimated.ScrollView
        ref={scrollRef}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingTop: headerHeight + theme.layout.screenTopGap,
          paddingBottom: theme.layout.screenScrollPad + insets.bottom,
        }}
      >
        {loadError && (
          <ScreenLoadError title="Investments" message={loadError} onRetry={() => void reload()} embedded />
        )}
        {none ? (
          <StartTracking onAdd={() => setAdding(true)} />
        ) : (
          loaded && (
            <>
              <InvestmentsHero
                portfolio={portfolio}
                rate={rate}
                currency={currency}
                sipMonthly={sipMonthly}
              />

              <View style={styles.mainActions}>
                <PrimaryButton
                  title="Invest money"
                  style={styles.mainAction}
                  onPress={() => choose('invest')}
                />
                <PrimaryButton
                  title="Update values"
                  variant="secondary"
                  style={styles.mainAction}
                  onPress={() => setUpdating(true)}
                />
              </View>

              {shown.length >= 2 && (
                <Glass radius={22} tone="strong" style={[styles.card, cardSurface.neutral, styles.block]}>
                  <SegmentedControl
                    options={[
                      { label: '6 months', value: '6m' },
                      { label: '1 year', value: '1y' },
                      { label: 'All', value: 'all' },
                    ]}
                    value={range}
                    onChange={setRange}
                  />
                  <PortfolioChart
                    points={shown}
                    currency={currency}
                    masked={hideAmounts}
                    color={theme.colors.ink}
                  />
                </Glass>
              )}

              {split.length > 1 && <SplitCard parts={split} />}

              <Section compact title="Holdings">
                <View style={[h.card, cardSurface.neutral]}>
                  {portfolio.holdings.map((holding, i) => (
                    <HoldingRow
                      key={holding.id}
                      holding={holding}
                      today={today}
                      masked={hideAmounts}
                      onPress={() => setSummary(holding.account)}
                      divider={i > 0}
                    />
                  ))}
                </View>
              </Section>

              {portfolio.otherCurrency.length > 0 && (
                <Section compact title="Other currencies">
                  <View style={[h.card, cardSurface.neutral]}>
                    {portfolio.otherCurrency.map((holding, i) => (
                      <HoldingRow
                        key={holding.id}
                        holding={holding}
                        today={today}
                        masked={hideAmounts}
                        onPress={() => setSummary(holding.account)}
                        divider={i > 0}
                      />
                    ))}
                  </View>
                  <Text style={[styles.hint, styles.hintPad]}>Not added into the totals above.</Text>
                </Section>
              )}

              <Section compact title="Monthly SIPs">
                <View style={[h.card, cardSurface.neutral]}>
                  {sips.map(sipRow)}
                  <SettingsRow
                    icon="plus"
                    round
                    label="Add a SIP"
                    sub="The same amount into an investment every month"
                    onPress={() => choose('sip')}
                    divider={sips.length > 0}
                  />
                </View>
              </Section>
            </>
          )
        )}
      </ReanimatedAnimated.ScrollView>
      <SkyHeader
        collapse={collapse}
        title="Investments"
        showBack
        hideUser
        wallpaper
        actions={
          <AddButton label="+ Add" onPress={() => setAdding(true)} accessibilityLabel="Add an investment" />
        }
      />

      <AccountSummarySheet
        account={summary}
        cursor={CURRENT_PERIOD}
        accounts={accounts}
        categories={categories}
        onClose={() => setSummary(null)}
        onAdd={(acc) => {
          setSummary(null);
          router.push(`/add-transaction?type=transfer&accountId=${acc.id}`);
        }}
        onEdit={(acc) => {
          setSummary(null);
          setEditing(acc);
        }}
        onSeeAll={(acc) => {
          setSummary(null);
          router.navigate(`/transactions?account=${acc.id}`);
        }}
        onChanged={() => void reload()}
        onInvest={(acc) => {
          setSummary(null);
          router.push(investHref(acc));
        }}
        onWithdraw={(acc) => {
          setSummary(null);
          router.push(withdrawHref(acc));
        }}
        onAddSip={(acc) => {
          setSummary(null);
          startSip(acc);
        }}
      />
      <AccountDetailModal
        account={editing}
        onClose={() => setEditing(null)}
        onChanged={() => {
          setEditing(null);
          void reload();
        }}
      />
      <AddAccountModal
        visible={adding}
        initialChoice="investment"
        onClose={() => setAdding(false)}
        onCreated={() => {
          setAdding(false);
          void reload();
        }}
      />
      <UpdateValuesSheet
        visible={updating}
        holdings={portfolio.holdings}
        onClose={() => setUpdating(false)}
        onChanged={() => void reload()}
      />
      <HoldingPickerSheet
        visible={picking !== null}
        title={picking === 'sip' ? 'A SIP into which investment?' : 'Invest in which one?'}
        holdings={portfolio.holdings}
        onPick={pick}
        onClose={() => setPicking(null)}
      />
      <RuleModal
        visible={rule !== null}
        editing={rule?.editing ?? null}
        accounts={accounts}
        categories={categories}
        prefill={prefill}
        onClose={() => setRule(null)}
        onSaved={() => {
          setRule(null);
          void reload();
        }}
        onDeleted={() => {
          setRule(null);
          void reload();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  // Cards sit on the screen gutter like every other screen's; the sections below bring their own.
  block: { marginTop: 0, marginBottom: 12 },
  card: { marginHorizontal: SCREEN.gutter, padding: 14, gap: 10 },
  hint: { fontFamily: theme.font.body, fontSize: 12, lineHeight: 17, color: theme.colors.textMuted },
  hintPad: { marginHorizontal: SCREEN.gutter, marginTop: 6 },
  mainActions: { flexDirection: 'row', gap: 8, marginHorizontal: SCREEN.gutter, marginBottom: 12 },
  mainAction: { flex: 1 },
});
