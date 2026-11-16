import { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
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
export default function InvestmentsScreen() {
  const insets = useSafeAreaInsets();
  const { collapse, headerHeight, scrollHandler, scrollRef } = useCollapsingHeader();
  const { accent, secondary } = useAccent();
  const { hideAmounts } = usePrivacy();
  // Which sheet is open lives outside React state: opening or closing one does not redraw the page behind it.
  const [sheets] = useState(createInvestmentsSheets);
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
  if (loadError && !hasData) {
    return <ScreenLoadError title="Investments" message={loadError} onRetry={() => void reload()} />;
  }

  const all = [...portfolio.holdings, ...portfolio.otherCurrency];
  const none = loaded && all.length === 0;
  const sipAmount = (sip: (typeof sips)[number]) =>
    money(sip.rule.amountMinor, accounts.find((account) => account.id === sip.rule.accountId)?.currency);

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

      <InvestmentsSheets
        sheets={sheets}
        accounts={accounts}
        categories={categories}
        holdings={portfolio.holdings}
        today={today}
        reload={reload}
      />
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
  })
);
