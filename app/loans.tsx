import { ScreenLoadError } from '@/components/ScreenLoadError';
import { useCallback, useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { View, Pressable } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from '@/components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listLoans, getLoanProgress, LoanProgress } from '@/db/loans';
import { Loan } from '@/types';
import { MovingRow } from '@/components/MovingRow';
import { EmptyState } from '@/components/EmptyState';
import { AddButton } from '@/components/AddButton';
import { SkyHeader, HeaderSummary } from '@/features/home/SkyHeader';
import ReanimatedAnimated from 'react-native-reanimated';
import { formatMoney } from '@/lib/money';
import { useCollapsingHeader } from '@/lib/useCollapsingHeader';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Skeleton } from '@/components/Skeleton';
import { theme } from '@/constants/theme';
import { SECTION_TITLE, SECTION_GAP } from '@/constants/textStyles';
import { useScreenLoad } from '@/lib/useScreenLoad';
import { styles } from '@/features/loans/loans.styles';
import { LoanCard } from '@/features/loans/LoanCard';
import { LoanDetailModal } from '@/features/loans/LoanDetailModal';
import { HomeWallpaper } from '@/features/home/HomeWallpaper';
import { useAccent } from '@/theme/AccentContext';
import { Glass } from '@/components/Glass';
import { LoansHero } from '@/features/loans/LoansHero';
import { loanHues } from '@/features/loans/loanIdentity';
import { debtShares, summarizeLoans } from '@/features/loans/loanTotals';
import { buildTimeline } from '@/features/loans/timelineLayout';
import { AddLoanModal } from '@/features/loans/AddLoanModal';
import { SCREEN } from '@/components/screenStyles';
import { showAlert } from '@/components/AppDialog';

/**
 * Formal loans with a schedule (informal IOUs live in /people). Reached from the Plan Loans tile, Home EMI
 * rows, loan-due notifications and the Next Due widget; /loans?pay=<loan id> opens that EMI's pay sheet.
 */
const listTitle = {
  ...SECTION_TITLE,
  marginHorizontal: SCREEN.gutter,
  marginTop: SECTION_GAP.top,
  marginBottom: SECTION_GAP.bottom,
};

export default function LoansScreen() {
  const insets = useSafeAreaInsets();
  const { accent, secondary } = useAccent();
  // The header sits over the page and shrinks as it scrolls.
  const { collapse, headerHeight, scrollHandler, scrollRef } = useCollapsingHeader();
  const [loans, setLoans] = useState<Loan[]>([]);
  // Each loan's EMIs paid, next EMI and last EMI, for its card and the hero.
  const [progress, setProgress] = useState<Record<string, LoanProgress>>({});
  const [closedOpen, setClosedOpen] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [payOnOpen, setPayOnOpen] = useState(false);
  const { pay: payLoanId, loan: detailLoanId } = useLocalSearchParams<{ pay?: string; loan?: string }>();

  const loadLoans = useCallback(async () => {
    const [list, rows] = await Promise.all([listLoans(), getLoanProgress()]);
    setLoans(list);
    setProgress(Object.fromEntries(rows.map((p) => [p.loanId, p])));
  }, []);
  const { loaded, hasData, loadError, reload: load } = useScreenLoad(loadLoans);
  const loading = !loaded && !loadError;
  useEffect(() => {
    // Consume each route request after a successful load. A later reminder must work in this same screen.
    const requested = payLoanId || detailLoanId;
    if (!loaded || loadError || !requested) return;
    router.setParams({ pay: undefined, loan: undefined });
    const selected = loans.find((loan) => loan.id === requested);
    setSelectedLoan(selected ?? null);
    setPayOnOpen(!!payLoanId && selected?.status !== 'closed');
    if (!selected)
      showAlert('Loan unavailable', 'This loan may have been deleted. Review your current loans below.');
  }, [loaded, loadError, payLoanId, detailLoanId, loans]);

  // A defaulted loan is still money owed (or owed to you), so only closed
  // loans drop out of the totals. Closed ones also sit apart in the list.
  const activeLoans = loans.filter((l) => l.status !== 'closed');
  const closedLoans = loans.filter((l) => l.status === 'closed');
  const hues = loanHues(loans);
  const totals = summarizeLoans(loans, progress);
  const shares = debtShares(loans);
  const timeline = buildTimeline(
    activeLoans.flatMap((l) => {
      const end = progress[l.id]?.lastDueDate;
      return l.direction === 'borrowed' && end ? [{ id: l.id, name: l.counterparty, endDate: end }] : [];
    }),
    new Date()
  );
  const payLoan = (loan: Loan) => {
    setPayOnOpen(true);
    setSelectedLoan(loan);
  };

  if (!hasData && loadError)
    return <ScreenLoadError title="Loans" message={loadError} onRetry={() => void load()} />;

  return (
    <View style={styles.container}>
      <HomeWallpaper accent={accent} secondary={secondary} />
      <ReanimatedAnimated.ScrollView
        ref={scrollRef}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingTop: headerHeight,
          paddingBottom: theme.layout.screenScrollPad + insets.bottom,
        }}
      >
        {loadError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorTitle}>Couldn't load your loans</Text>
            <Text style={styles.errorDetail}>{loadError}</Text>
            <PrimaryButton title="Retry" compact variant="secondary" onPress={() => void load()} />
          </View>
        )}
        {(loading || loans.length > 0) && (
          <LoansHero totals={totals} shares={shares} hues={hues} timeline={timeline} loading={loading} />
        )}
        {loading ? (
          [0, 1].map((i) => (
            <Glass key={i} style={styles.card}>
              <Skeleton width={140} height={14} radius={4} />
              <Skeleton width={100} height={10} radius={4} style={{ marginTop: 8 }} />
              <Skeleton width={220} height={6} radius={3} style={{ marginTop: 12 }} />
            </Glass>
          ))
        ) : loans.length === 0 ? (
          <EmptyState title="No loans yet" subtitle="Add one and Yume works out the EMI schedule for you.">
            <PrimaryButton title="Add a loan" onPress={() => setModalVisible(true)} />
          </EmptyState>
        ) : (
          <>
            {activeLoans.length > 0 && <Text style={listTitle}>Your loans</Text>}
            {activeLoans.map((loan) => (
              <MovingRow key={loan.id}>
                <LoanCard
                  loan={loan}
                  hue={hues[loan.id]}
                  progress={progress[loan.id]}
                  onPress={() => setSelectedLoan(loan)}
                  onPay={() => payLoan(loan)}
                />
              </MovingRow>
            ))}
            {closedLoans.length > 0 && (
              <>
                <Pressable
                  onPress={() => setClosedOpen((v) => !v)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: closedOpen }}
                  style={styles.closedHeader}
                >
                  <Text style={styles.closedDivider}>Closed · {closedLoans.length}</Text>
                  <MaterialCommunityIcons
                    name={closedOpen ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={theme.colors.textMuted}
                  />
                </Pressable>
                {closedOpen &&
                  closedLoans.map((loan) => (
                    <MovingRow key={loan.id}>
                      <LoanCard
                        loan={loan}
                        hue={hues[loan.id]}
                        progress={progress[loan.id]}
                        onPress={() => setSelectedLoan(loan)}
                        onPay={() => payLoan(loan)}
                      />
                    </MovingRow>
                  ))}
              </>
            )}
          </>
        )}
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
        actions={<AddButton onPress={() => setModalVisible(true)} label="+ Loan" />}
      />

      <AddLoanModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onCreated={async () => {
          setModalVisible(false);
          await load();
        }}
      />

      {selectedLoan && (
        <LoanDetailModal
          loan={selectedLoan}
          hue={hues[selectedLoan.id]}
          startWithPay={payOnOpen}
          onClose={() => {
            setSelectedLoan(null);
            setPayOnOpen(false);
          }}
          onChanged={load}
        />
      )}
    </View>
  );
}
