import { ActionSheet } from '@/components/ActionSheet';
import { ModalSheet } from '@/components/ModalSheet';
import { withPressed } from '@/lib/pressed';
import { planMoneyList } from '@/features/plan/plan.styles';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ReanimatedAnimated from 'react-native-reanimated';
import { Text } from '@/components/Text';
import { ListCard } from '@/components/SummaryCard';
import { AddButton } from '@/components/AddButton';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SettingsRow } from '@/components/SettingsRow';
import { CardRowsSkeleton, SummarySkeleton } from '@/components/ListSkeleton';
import { ScreenLoadError } from '@/components/ScreenLoadError';
import { LoadFade } from '@/components/LoadFade';
import { Section } from '@/components/Section';
import { SCREEN } from '@/components/screenStyles';
import { SkyHeader } from '@/features/home/SkyHeader';
import { HomeWallpaper } from '@/features/home/HomeWallpaper';
import { HoldingRow } from '@/features/investments/HoldingRow';
import { InvestmentsHero, StartTracking } from '@/features/investments/InvestmentsHero';
import { SplitCard } from '@/features/investments/SplitCard';
import { PortfolioCard } from '@/features/investments/PortfolioCard';
import { InvestmentsSheets } from '@/features/investments/InvestmentsSheets';
import { createInvestmentsSheets } from '@/features/investments/investmentsSheetsStore';
import { SipRow } from '@/features/investments/SipRow';
import { useInvestmentsData } from '@/features/investments/useInvestmentsData';
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';
import { usePrivacy } from '@/theme/PrivacyContext';
import { useCollapsingHeader } from '@/lib/useCollapsingHeader';
import { useStableCallback } from '@/lib/useStableCallback';
import { toLocalIsoDate } from '@/lib/date';
import { formatMaskableMoney } from '@/lib/money';
import { investHref } from '@/lib/investRoutes';
import { gainLabel } from '@/lib/investment';
import {
  annualisedReturn,
  buildPortfolio,
  buildSeries,
  monthlySipTotal,
  sipsOf,
  splitOf,
} from '@/lib/portfolio';
import { themedStyles } from '@/theme/themedStyles';

/**
 * Investments as one page: what they are worth, the gain and the yearly rate, the trend, where the money sits,
 * each holding, and the SIPs going in. Reached from Plan and from Profile. Values are the ones you enter, so
 * each holding shows how old its value is.
 */
export default function InvestmentsWorkspace({
  embedded = false,
  refreshToken,
  onChanged,
  fallback,
}: {
  embedded?: boolean;
  refreshToken?: object;
  onChanged?: () => Promise<void>;
  fallback?: React.ReactNode;
} = {}) {
  const insets = useSafeAreaInsets();
  const { collapse, headerHeight, scrollHandler, scrollRef } = useCollapsingHeader();
  const { accent, secondary } = useAccent();
  const { hideAmounts } = usePrivacy();
  // Which sheet is open lives outside React state: opening or closing one does not redraw the page behind it.
  const [sheets] = useState(createInvestmentsSheets);
  const [details, setDetails] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const { accounts, categories, rules, currency, history, loaded, hasData, loadError, reload } =
    useInvestmentsData();
  const today = toLocalIsoDate(new Date());

  const portfolio = useMemo(() => buildPortfolio(accounts, currency, today), [accounts, currency, today]);
  const rate = useMemo(() => annualisedReturn(portfolio, history.flows, today), [portfolio, history, today]);
  const series = useMemo(() => buildSeries(portfolio, history, today), [portfolio, history, today]);
  const split = useMemo(() => splitOf(portfolio.holdings), [portfolio]);
  const sips = useMemo(() => sipsOf(rules, accounts), [rules, accounts]);
  const sipMonthly = useMemo(() => monthlySipTotal(sips, accounts, currency), [sips, accounts, currency]);
  const money = (minor: number, cur = currency) =>
    formatMaskableMoney(minor, { currency: cur, masked: hideAmounts });

  // One function for the sheets' buttons and the rows, whatever the page last drew.
  const choose = useStableCallback((mode: 'invest' | 'sip') => {
    if (portfolio.holdings.length === 1) {
      const only = portfolio.holdings[0];
      if (mode === 'invest') router.push(investHref(only.account));
      else sheets.startSip(only.account);
    } else sheets.pick(mode);
  });
  const renderedToken = useRef(refreshToken);
  useEffect(() => {
    if (renderedToken.current === refreshToken) return;
    renderedToken.current = refreshToken;
    void reload();
  }, [reload, refreshToken]);
  const reloadAfterChange = async () => {
    await reload();
    await onChanged?.();
  };
  if (!embedded && loadError && !hasData) {
    return <ScreenLoadError title="Investments" message={loadError} onRetry={() => void reload()} />;
  }

  const all = [...portfolio.holdings, ...portfolio.otherCurrency];
  const portfolioValue =
    portfolio.holdings.length > 0
      ? money(portfolio.valueMinor)
      : `${all.length} holdings in other currencies`;
  const portfolioGain =
    portfolio.gainMinor == null
      ? null
      : gainLabel(
          { gainMinor: portfolio.gainMinor, investedMinor: portfolio.investedMinor },
          { currency, masked: hideAmounts }
        );
  const showPortfolioTotals = all.length > 1;
  const none = loaded && all.length === 0;
  const sipAmount = (sip: (typeof sips)[number]) =>
    money(sip.rule.amountMinor, accounts.find((account) => account.id === sip.rule.accountId)?.currency);

  const workspaceSheets = (
    <InvestmentsSheets
      sheets={sheets}
      accounts={accounts}
      categories={categories}
      holdings={portfolio.holdings}
      today={today}
      reload={reloadAfterChange}
    />
  );
  if (embedded) {
    if (!loaded) return fallback ?? <CardRowsSkeleton rows={2} subtitle />;
    if (loadError && !hasData) {
      return (
        <ScreenLoadError title="Investments" message={loadError} onRetry={() => void reload()} embedded />
      );
    }
    const portfolioControls = (
      <View style={[styles.portfolioRow, !showPortfolioTotals && styles.portfolioFooter]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            showPortfolioTotals
              ? [`Portfolio value, ${portfolioValue}`, portfolioGain].filter(Boolean).join(', ')
              : 'Portfolio details'
          }
          accessibilityHint={showPortfolioTotals ? 'Opens portfolio details' : undefined}
          onPress={() => setDetails(true)}
          style={withPressed(styles.portfolio)}
        >
          <Text style={styles.portfolioLabel}>
            {showPortfolioTotals ? 'Portfolio value' : 'Portfolio details'}
          </Text>
          {showPortfolioTotals && (
            <View style={styles.portfolioFigures}>
              <Text style={styles.portfolioValue}>{portfolioValue}</Text>
              {portfolioGain && <Text style={styles.portfolioGain}>{portfolioGain}</Text>}
            </View>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Investment actions"
          onPress={() => setActionsOpen(true)}
          style={withPressed(styles.portfolioMore)}
        >
          <Feather name="more-horizontal" size={18} color={theme.colors.link} />
        </Pressable>
      </View>
    );
    return (
      <>
        {none ? (
          <ListCard style={planMoneyList}>
            <Text style={styles.emptyPortfolio}>No investments tracked yet.</Text>
          </ListCard>
        ) : (
          <>
            <ListCard style={planMoneyList}>
              {showPortfolioTotals && portfolioControls}
              {all.map((holding, index) => (
                <HoldingRow
                  key={holding.id}
                  holding={holding}
                  today={today}
                  masked={hideAmounts}
                  onOpen={sheets.openSummary}
                  divider={showPortfolioTotals || index > 0}
                />
              ))}
              {!showPortfolioTotals && portfolioControls}
            </ListCard>
          </>
        )}
        {details && (
          <ModalSheet ledgerStyle visible title="Portfolio details" onClose={() => setDetails(false)}>
            <InvestmentsHero portfolio={portfolio} rate={rate} currency={currency} sipMonthly={sipMonthly} />
            <PortfolioCard series={series} today={today} currency={currency} masked={hideAmounts} />
            {split.length > 1 && <SplitCard parts={split} />}
            {sips.length > 0 && (
              <Section compact title="Monthly SIPs">
                <ListCard>
                  {sips.map((sip, index) => (
                    <SipRow
                      key={sip.rule.id}
                      sip={sip}
                      value={sipAmount(sip)}
                      divider={index > 0}
                      onOpen={(rule) => {
                        setDetails(false);
                        sheets.editSip(rule);
                      }}
                    />
                  ))}
                </ListCard>
              </Section>
            )}
          </ModalSheet>
        )}
        <ActionSheet
          ledgerStyle
          visible={actionsOpen}
          title="Investment actions"
          onClose={() => setActionsOpen(false)}
          items={[
            { key: 'invest', label: 'Invest money', icon: 'arrow-up-right', onPress: () => choose('invest') },
            { key: 'update', label: 'Update values', icon: 'edit-2', onPress: sheets.openUpdate },
            { key: 'sip', label: 'Add a SIP', icon: 'repeat', onPress: () => choose('sip') },
          ]}
        />
        {workspaceSheets}
      </>
    );
  }

  return (
    <View style={styles.container}>
      <HomeWallpaper accent={accent} secondary={secondary} />
      <ReanimatedAnimated.ScrollView
        ref={scrollRef}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{
          // The first card brings the top gap itself (as on Budgets, Goals and Loans), so the page adds none.
          paddingTop: headerHeight,
          paddingBottom: theme.layout.screenScrollPad + insets.bottom,
        }}
      >
        <LoadFade loaded={loaded || !!loadError}>
          {loadError && (
            <ScreenLoadError title="Investments" message={loadError} onRetry={() => void reload()} embedded />
          )}
          {!loaded && !loadError ? (
            // The same placeholders every other screen shows while it loads, instead of an empty screen.
            <>
              <SummarySkeleton />
              <View style={{ marginTop: 16 }}>
                <CardRowsSkeleton rows={3} subtitle />
              </View>
            </>
          ) : none ? (
            <StartTracking onAdd={sheets.openAdd} />
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
                    onPress={sheets.openUpdate}
                  />
                </View>

                <PortfolioCard series={series} today={today} currency={currency} masked={hideAmounts} />

                {split.length > 1 && <SplitCard parts={split} />}

                <Section compact title="Holdings">
                  <ListCard>
                    {portfolio.holdings.map((holding, i) => (
                      <HoldingRow
                        key={holding.id}
                        holding={holding}
                        today={today}
                        masked={hideAmounts}
                        onOpen={sheets.openSummary}
                        divider={i > 0}
                      />
                    ))}
                  </ListCard>
                </Section>

                {portfolio.otherCurrency.length > 0 && (
                  <Section compact title="Other currencies">
                    <ListCard>
                      {portfolio.otherCurrency.map((holding, i) => (
                        <HoldingRow
                          key={holding.id}
                          holding={holding}
                          today={today}
                          masked={hideAmounts}
                          onOpen={sheets.openSummary}
                          divider={i > 0}
                        />
                      ))}
                    </ListCard>
                    <Text style={[styles.hint, styles.hintPad]}>Not added into the totals above.</Text>
                  </Section>
                )}

                <Section compact title="Monthly SIPs">
                  <ListCard>
                    {sips.map((sip, i) => (
                      <SipRow
                        key={sip.rule.id}
                        sip={sip}
                        value={sipAmount(sip)}
                        divider={i > 0}
                        onOpen={sheets.editSip}
                      />
                    ))}
                    <SettingsRow
                      icon="plus"
                      round
                      label="Add a SIP"
                      sub="The same amount into an investment every month"
                      onPress={() => choose('sip')}
                      divider={sips.length > 0}
                    />
                  </ListCard>
                </Section>
              </>
            )
          )}
        </LoadFade>
      </ReanimatedAnimated.ScrollView>
      <SkyHeader
        collapse={collapse}
        title="Investments"
        showBack
        hideUser
        wallpaper
        actions={<AddButton label="+ Add" onPress={sheets.openAdd} accessibilityLabel="Add an investment" />}
      />

      {workspaceSheets}
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    hint: { fontFamily: theme.font.body, fontSize: 12, lineHeight: 17, color: theme.colors.textMuted },
    hintPad: { marginHorizontal: SCREEN.gutter, marginTop: 6 },
    mainActions: { flexDirection: 'row', gap: 8, marginHorizontal: SCREEN.gutter, marginTop: 12 },
    mainAction: { flex: 1 },
    portfolio: {
      flex: 1,
      minWidth: 0,
      minHeight: 44,
      paddingHorizontal: 12,
      paddingVertical: 8,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 6,
      justifyContent: 'space-between',
    },
    emptyPortfolio: { padding: 12, color: theme.colors.textMuted, fontSize: 13 },
    portfolioRow: { flexDirection: 'row', alignItems: 'center' },
    portfolioFooter: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.home.edge },
    portfolioMore: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    portfolioLabel: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.link },
    portfolioFigures: { flexShrink: 1, alignItems: 'flex-end' },
    portfolioGain: {
      fontFamily: theme.font.body,
      fontSize: 12,
      color: theme.colors.textMuted,
      textAlign: 'right',
    },
    portfolioValue: {
      fontFamily: theme.font.bodyBold,
      fontSize: 14,
      color: theme.colors.textPrimary,
      fontVariant: ['tabular-nums'],
      textAlign: 'right',
    },
  })
);
