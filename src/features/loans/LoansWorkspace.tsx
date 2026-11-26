import { planWorkspaceCard } from '@/features/plan/plan.styles';
import { ScreenLoadError } from '@/components/ScreenLoadError';
import { Appear } from '@/components/Appear';
import { LoadFade } from '@/components/LoadFade';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Text } from '@/components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState } from '@/components/EmptyState';
import { AddButton } from '@/components/AddButton';
import { SkyHeader, HeaderSummary } from '@/features/home/SkyHeader';
import ReanimatedAnimated from 'react-native-reanimated';
import { formatMoney } from '@/lib/money';
import { useCollapsingHeader } from '@/hooks/useCollapsingHeader';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Skeleton } from '@/components/Skeleton';
import { theme } from '@/constants/theme';
import { SECTION_TITLE, SECTION_GAP } from '@/constants/textStyles';
import { parseLocalIsoDate } from '@/lib/date';
import { styles } from '@/features/loans/loans.styles';
import { ClosedLoans } from '@/features/loans/ClosedLoans';
import { LoanListItem } from '@/features/loans/LoanListItem';
import { LoansSheets } from '@/features/loans/LoansSheets';
import { HomeWallpaper } from '@/features/home/HomeWallpaper';
import { LoanPayoffTools, LoansHero } from '@/features/loans/LoansHero';
import { buildLoansModel } from '@/features/loans/loansModel';
import { createLoansSheets } from '@/features/loans/loansSheetsStore';
import { useLoansData } from '@/features/loans/useLoansData';
import { SCREEN } from '@/components/screenStyles';
import { showAlert } from '@/components/AppDialog';
import { themedValue } from '@/theme/themedStyles';

// The hero compares its props by identity: it is drawn again only when the totals, shares or timeline change.
const Hero = memo(LoansHero);

const listTitle = themedValue(() => ({
  ...SECTION_TITLE,
  marginHorizontal: SCREEN.gutter,
  marginTop: SECTION_GAP.top,
  marginBottom: SECTION_GAP.bottom,
}));

/**
 * Formal loans with a schedule (informal IOUs live in /people). Reached from the Plan Loans tile, Home EMI
 * rows, loan-due notifications and the Next Due widget; /loans?pay=<loan id> opens that EMI's pay sheet.
 */
export default function LoansWorkspace({
  embedded = false,
  refreshToken,
  onChanged,
  payoffAction,
}: {
  embedded?: boolean;
  refreshToken?: object;
  onChanged?: () => Promise<void>;
  payoffAction?: React.ReactNode;
} = {}) {
  const insets = useSafeAreaInsets();
  // The header sits over the page and shrinks as it scrolls.
  const { collapse, headerHeight, scrollHandler, scrollRef } = useCollapsingHeader();
  // Which sheet is open is kept outside React state, so opening or closing one does not redraw the page behind it.
  const [sheets] = useState(createLoansSheets);
  const { loans, progress, today, loaded, hasData, loadError, reload: load } = useLoansData();
  const { pay: payLoanId, loan: detailLoanId } = useLocalSearchParams<{ pay?: string; loan?: string }>();
  const loading = !loaded && !loadError;
  useEffect(() => {
    // Consume each route request after a successful load. A later reminder must work in this same screen.
    const requested = payLoanId || detailLoanId;
    if (!loaded || loadError || !requested) return;
    router.setParams({ pay: undefined, loan: undefined });
    const selected = loans.find((loan) => loan.id === requested);
    sheets.show(selected ?? null, !!payLoanId && selected?.status !== 'closed');
    if (!selected)
      showAlert('Loan unavailable', 'This loan may have been deleted. Review your current loans below.');
  }, [loaded, loadError, payLoanId, detailLoanId, loans, sheets]);

  const { activeLoans, closedLoans, hues, totals, shares, timeline } = useMemo(
    () => buildLoansModel(loans, progress, today ? parseLocalIsoDate(today) : new Date()),
    [loans, progress, today]
  );
  const orderedLoans = useMemo(() => {
    if (!embedded) return activeLoans;
    const nextDate = (loan: (typeof activeLoans)[number]) =>
      (progress[loan.id] ? progress[loan.id].nextDueDate : loan.nextDueDate) ?? '9999-12-31';
    return [...activeLoans].sort((left, right) => nextDate(left).localeCompare(nextDate(right)));
  }, [activeLoans, embedded, progress]);
  const borrowed = embedded ? orderedLoans.filter((loan) => loan.direction === 'borrowed') : orderedLoans;
  const lent = embedded ? orderedLoans.filter((loan) => loan.direction === 'lent') : [];

  const renderedToken = useRef(refreshToken);
  useEffect(() => {
    if (renderedToken.current === refreshToken) return;
    renderedToken.current = refreshToken;
    void load();
  }, [load, refreshToken]);
  const reloadAfterChange = async () => {
    await load();
    await onChanged?.();
  };

  if (!embedded && !hasData && loadError)
    return <ScreenLoadError title="Loans" message={loadError} onRetry={() => void load()} />;

  const content = (
    <>
      <LoadFade loaded={!loading}>
        {loadError && (
          <Appear style={styles.errorBanner}>
            <Text style={styles.errorTitle}>Couldn’t load your loans</Text>
            <Text style={styles.errorDetail}>{loadError}</Text>
            <PrimaryButton title="Retry" compact variant="secondary" onPress={() => void load()} />
          </Appear>
        )}
        {(loading || loans.length > 0) && (
          <Hero
            ledgerStyle={embedded}
            totals={totals}
            shares={shares}
            hues={hues}
            timeline={timeline}
            loading={loading}
          />
        )}
        {loading ? (
          [0, 1].map((i) => (
            <View key={i} style={[styles.card, { marginHorizontal: SCREEN.gutter }]}>
              <Skeleton width={140} height={14} radius={4} />
              <Skeleton width={100} height={10} radius={4} style={{ marginTop: 8 }} />
              <Skeleton width={220} height={6} radius={3} style={{ marginTop: 12 }} />
            </View>
          ))
        ) : loans.length === 0 ? (
          <EmptyState title="No loans yet" subtitle="Add one and Yume works out the EMI schedule for you.">
            {!embedded && <PrimaryButton title="Add a loan" onPress={sheets.openAdd} />}
          </EmptyState>
        ) : (
          <>
            {[
              { title: 'Your loans', rows: borrowed },
              { title: 'Money lent', rows: lent },
            ].map(
              ({ title, rows }) =>
                rows.length > 0 && (
                  <View key={title}>
                    <Text accessibilityRole="header" style={listTitle}>
                      {title}
                    </Text>
                    <View style={embedded ? planWorkspaceCard : undefined}>
                      {rows.map((loan, index) => (
                        <LoanListItem
                          compact={embedded}
                          divider={index > 0}
                          nextPayment={embedded && index === 0 && loan.direction === 'borrowed'}
                          key={loan.id}
                          loan={loan}
                          hue={hues[loan.id]}
                          progress={progress[loan.id]}
                          onOpen={sheets.openLoan}
                          onPay={sheets.payLoan}
                        />
                      ))}
                    </View>
                  </View>
                )
            )}
            {embedded && totals.youOweMinor > 0 && (
              <LoanPayoffTools timeline={timeline} shares={shares} action={payoffAction} embedded />
            )}
            {closedLoans.length > 0 && (
              <ClosedLoans
                compact={embedded}
                loans={closedLoans}
                hues={hues}
                progress={progress}
                onOpen={sheets.openLoan}
                onPay={sheets.payLoan}
              />
            )}
          </>
        )}
      </LoadFade>
    </>
  );
  const workspaceSheets = (
    <>
      <LoansSheets ledgerStyle={embedded} sheets={sheets} hues={hues} reload={reloadAfterChange} />
    </>
  );
  if (embedded) {
    return (
      <>
        {content}
        {workspaceSheets}
      </>
    );
  }

  return (
    <View style={styles.container}>
      <HomeWallpaper />
      <ReanimatedAnimated.ScrollView
        ref={scrollRef}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingTop: headerHeight,
          paddingBottom: theme.layout.screenScrollPad + insets.bottom,
        }}
      >
        {content}
      </ReanimatedAnimated.ScrollView>
      <SkyHeader
        collapse={collapse}
        summary={
          totals.youOweMinor > 0 ? (
            <HeaderSummary
              figure={formatMoney(totals.youOweMinor)}
              rest="to repay"
              dot={theme.colors.slice.spent}
            />
          ) : undefined
        }
        title="Loans"
        showBack
        hideUser
        wallpaper
        actions={<AddButton onPress={sheets.openAdd} label="+ Loan" />}
      />
      {workspaceSheets}
    </View>
  );
}
