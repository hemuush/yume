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
import { screenStyles as h } from '@/components/screenStyles';
import { SkyHeader } from '@/features/home/SkyHeader';
import { HomeWallpaper } from '@/features/home/HomeWallpaper';
import { AccountSummarySheet } from '@/features/home/AccountSummarySheet';
import { AccountDetailModal } from '@/features/profile/AccountDetailModal';
import { AddAccountModal } from '@/features/profile/AddAccountModal';
import { RuleModal } from '@/features/recurring/RuleModal';
import { ruleCadenceLabel } from '@/features/recurring/recurring.helpers';
import { GainBadge } from '@/features/investments/GainPill';
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
import { formatReturnPct, ageLabel, INVESTMENT_KIND_LABEL } from '@/lib/investment';
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
  const gain = portfolio.gainMinor;
  const gainColor =
    gain == null || gain === 0
      ? theme.colors.textPrimary
      : gain > 0
        ? theme.colors.incomeText
        : theme.colors.expenseText;

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
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + theme.layout.screenTopGap,
            paddingBottom: theme.layout.screenScrollPad + insets.bottom,
          },
        ]}
      >
        {none ? (
          <Glass radius={28} tone="strong" style={styles.card}>
            <Text style={styles.title}>Start tracking in 3 steps</Text>
            {[
              'Add an investment: a fund, stocks, gold or a deposit.',
              'Invest money into it from a bank account.',
              'Update its value now and then to see the gain.',
            ].map((line, i) => (
              <View key={line} style={styles.stepRow}>
                <View style={styles.stepNum}>
                  <Text style={styles.stepNumText}>{i + 1}</Text>
                </View>
                <Text style={styles.stepText}>{line}</Text>
              </View>
            ))}
            <PrimaryButton title="Add your first investment" onPress={() => setAdding(true)} />
          </Glass>
        ) : (
          loaded && (
            <>
              <Glass radius={28} tone="strong" style={styles.card}>
                <Text style={styles.kicker}>Worth now</Text>
                <Text style={styles.figure} accessibilityLabel={`Worth now ${money(portfolio.valueMinor)}`}>
                  {money(portfolio.valueMinor)}
                </Text>
                {gain != null && (
                  <Text
                    style={[styles.gainLine, { color: hideAmounts ? theme.colors.textPrimary : gainColor }]}
                    accessibilityLabel={
                      hideAmounts
                        ? 'Gain hidden'
                        : `Gain ${money(Math.abs(gain))}${
                            portfolio.returnPct == null ? '' : `, ${formatReturnPct(portfolio.returnPct)}`
                          }`
                    }
                  >
                    {hideAmounts
                      ? '••'
                      : `${gain < 0 ? '▼ −' : gain > 0 ? '▲ ' : ''}${money(Math.abs(gain))}${
                          portfolio.returnPct == null ? '' : ` · ${formatReturnPct(portfolio.returnPct)}`
                        }`}
                  </Text>
                )}
                <View style={styles.trio}>
                  <Stat label="Put in" value={money(portfolio.investedMinor)} />
                  <Stat label="Taken out" value={money(portfolio.takenOutMinor)} />
                  <Stat label="SIPs / month" value={money(sipMonthly)} />
                </View>
                <Text style={styles.hint}>
                  {rate
                    ? hideAmounts
                      ? 'About ••% a year'
                      : `About ${formatReturnPct(rate.rate * 100).replace('+', '')} a year, over ${years(rate.days)}`
                    : gain == null
                      ? 'Update a value to see the gain.'
                      : 'A yearly rate needs three months of history.'}
                  {portfolio.unvaluedCount > 0 && gain != null
                    ? ` ${portfolio.unvaluedCount} ${portfolio.unvaluedCount === 1 ? 'holding has' : 'holdings have'} no value yet.`
                    : ''}
                </Text>
              </Glass>

              {shown.length >= 2 && (
                <Glass radius={28} tone="strong" style={styles.card}>
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

              {split.length > 1 && (
                <Glass radius={28} tone="strong" style={styles.card}>
                  <Text style={styles.label}>Where it sits</Text>
                  <View
                    style={styles.bar}
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                  >
                    {split.map((p, i) => (
                      <View
                        key={p.key}
                        style={{
                          flex: Math.max(p.share, 0.01),
                          backgroundColor: SPLIT_COLORS[i % SPLIT_COLORS.length],
                        }}
                      />
                    ))}
                  </View>
                  {split.map((p, i) => (
                    <View
                      key={p.key}
                      style={styles.legendRow}
                      accessible
                      accessibilityLabel={`${p.label}, ${Math.round(p.share * 100)} percent`}
                    >
                      <View
                        style={[styles.dot, { backgroundColor: SPLIT_COLORS[i % SPLIT_COLORS.length] }]}
                      />
                      <Text style={styles.legendName} numberOfLines={1}>
                        {p.label}
                      </Text>
                      <Text style={styles.legendShare}>{Math.round(p.share * 100)}%</Text>
                    </View>
                  ))}
                </Glass>
              )}

              <Section
                compact
                title="Holdings"
                right={
                  <AddButton
                    label="+ Add"
                    onPress={() => setAdding(true)}
                    accessibilityLabel="Add an investment"
                  />
                }
              >
                <View style={[h.card, cardSurface.neutral]}>
                  {portfolio.holdings.map((holding, i) => (
                    <HoldingRow
                      key={holding.id}
                      holding={holding}
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
                        masked={hideAmounts}
                        onPress={() => setSummary(holding.account)}
                        divider={i > 0}
                      />
                    ))}
                  </View>
                  <Text style={styles.hint}>Not added into the totals above.</Text>
                </Section>
              )}

              <Section
                compact
                title="Monthly SIPs"
                right={
                  <AddButton label="+ Add" onPress={() => choose('sip')} accessibilityLabel="Add a SIP" />
                }
              >
                {sips.length === 0 ? (
                  <Text style={styles.hint}>
                    A SIP puts the same amount into an investment every month. Tap + Add to set one up.
                  </Text>
                ) : (
                  <View style={[h.card, cardSurface.neutral]}>{sips.map(sipRow)}</View>
                )}
              </Section>
            </>
          )
        )}
      </ReanimatedAnimated.ScrollView>
      <SkyHeader collapse={collapse} title="Investments" showBack hideUser wallpaper />

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

const SPLIT_COLORS = ['#8FCBFF', '#F0E1A8', '#8FE8C8', '#E2A6D8', '#F6BFD3', '#BEC8D4'];

const years = (days: number) => {
  const y = days / 365;
  return y >= 2 ? `${Math.round(y * 10) / 10} years` : `${Math.max(1, Math.round(days / 30.44))} months`;
};

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, color ? { color } : null]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function HoldingRow({
  holding,
  masked,
  onPress,
  divider,
}: {
  holding: Holding;
  masked: boolean;
  onPress: () => void;
  divider: boolean;
}) {
  const cur = holding.account.currency;
  const sub = [
    holding.kind ? INVESTMENT_KIND_LABEL[holding.kind] : null,
    holding.ageDays == null ? 'No value yet' : ageLabel(holding.ageDays),
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <SettingsRow
      icon="trending-up"
      round
      label={holding.name}
      sub={sub}
      subColor={holding.stale ? theme.colors.warnInk : undefined}
      onPress={onPress}
      divider={divider}
      right={
        <View style={styles.rowRight}>
          <Text style={styles.rowValue} numberOfLines={1}>
            {formatMaskableMoney(holding.valueMinor, { currency: cur, masked })}
          </Text>
          {holding.gainMinor != null && (
            <GainBadge
              gainMinor={holding.gainMinor}
              investedMinor={holding.investedMinor}
              currency={cur}
              moneyOnly
            />
          )}
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingHorizontal: 16, gap: 12 },
  card: { padding: 14, gap: 10 },
  title: { fontFamily: theme.font.roundedBold, fontSize: 20, color: theme.colors.textPrimary },
  kicker: { fontFamily: theme.font.bodyBold, fontSize: 12, color: theme.colors.textSecondary },
  figure: { fontFamily: theme.font.roundedBold, fontSize: 34, color: theme.colors.textPrimary },
  label: { fontFamily: theme.font.bodyBold, fontSize: 12, color: theme.colors.textSecondary },
  hint: { fontFamily: theme.font.body, fontSize: 12, lineHeight: 17, color: theme.colors.textMuted },
  trio: { flexDirection: 'row', gap: 8 },
  stat: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
  },
  statValue: { fontFamily: theme.font.bodyBold, fontSize: 15, color: theme.colors.textPrimary },
  statLabel: { fontFamily: theme.font.body, fontSize: 11, color: theme.colors.textMuted },
  bar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendName: {
    flex: 1,
    minWidth: 0,
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.textPrimary,
  },
  legendShare: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.textSecondary },
  rowRight: { alignItems: 'flex-end', gap: 3, flexShrink: 1 },
  rowValue: { fontFamily: theme.font.bodyBold, fontSize: 14, color: theme.colors.textPrimary },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
  },
  stepNumText: { fontFamily: theme.font.bodyBold, fontSize: 12, color: theme.colors.onFlat },
  stepText: { flex: 1, fontFamily: theme.font.body, fontSize: 13, color: theme.colors.textPrimary },
  mainActions: { flexDirection: 'row', gap: 8 },
  mainAction: { flex: 1 },
  gainLine: { fontFamily: theme.font.bodyBold, fontSize: 14 },
});
