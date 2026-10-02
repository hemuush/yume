import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { View, ScrollView, Pressable } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from '@/components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listLoans, getLoanProgress, LoanProgress } from '@/db/loans';
import { Loan } from '@/types';
import { MovingRow } from '@/components/MovingRow';
import { EmptyState } from '@/components/EmptyState';
import { AddButton } from '@/components/AddButton';
import { AppHeader } from '@/components/AppHeader';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Skeleton } from '@/components/Skeleton';
import { theme } from '@/constants/theme';
import { useFadeIn } from '@/lib/useFadeIn';
import { useScreenLoad } from '@/lib/useScreenLoad';
import { styles } from '@/features/loans/loans.styles';
import { LoanCard } from '@/features/loans/LoanCard';
import { LoanDetailModal } from '@/features/loans/LoanDetailModal';
import { LoansHero } from '@/features/loans/LoansHero';
import { LoanTimeline } from '@/features/loans/LoanTimeline';
import { loanHues } from '@/features/loans/loanIdentity';
import { summarizeLoans } from '@/features/loans/loanTotals';
import { buildTimeline } from '@/features/loans/timelineLayout';
import { AddLoanModal } from '@/features/loans/AddLoanModal';

/**
 * Formal loans with a schedule. Reached from the Plan tab's Loans tile, and
 * from Home's EMI rows, loan-due notifications and the Next Due widget via
 * /loans. Informal IOUs have their own screen (/people). An EMI reminder's
 * "Pay now" opens /loans?pay=<loan id>, straight onto that EMI's pay sheet.
 */
export default function LoansScreen() {
  const insets = useSafeAreaInsets();
  const [loans, setLoans] = useState<Loan[]>([]);
  // Each loan's EMIs paid, next EMI and last EMI, for its card and the hero.
  const [progress, setProgress] = useState<Record<string, LoanProgress>>({});
  const [closedOpen, setClosedOpen] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [payOnOpen, setPayOnOpen] = useState(false);
  const { pay: payLoanId } = useLocalSearchParams<{ pay?: string }>();
  const listFadeStyle = useFadeIn();

  const loadLoans = useCallback(async () => {
    const [list, rows] = await Promise.all([listLoans(), getLoanProgress()]);
    setLoans(list);
    setProgress(Object.fromEntries(rows.map((p) => [p.loanId, p])));
  }, []);
  const { loaded, loadError, reload: load } = useScreenLoad(loadLoans);
  const loading = !loaded && !loadError;

  // Once, when the loans have loaded: open the loan "Pay now" asked for.
  const [payHandled, setPayHandled] = useState(false);
  useEffect(() => {
    if (!loaded || payHandled || !payLoanId) return;
    setPayHandled(true);
    const loan = loans.find((l) => l.id === payLoanId && l.status !== 'closed');
    if (!loan) return;
    setPayOnOpen(true);
    setSelectedLoan(loan);
  }, [loaded, payHandled, payLoanId, loans]);

  // A defaulted loan is still money owed (or owed to you), so only closed
  // loans drop out of the totals. Closed ones also sit apart in the list.
  const activeLoans = loans.filter((l) => l.status !== 'closed');
  const closedLoans = loans.filter((l) => l.status === 'closed');
  const hues = loanHues(loans);
  const totals = summarizeLoans(loans, progress);
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

  return (
    <View style={styles.container}>
      <AppHeader
        title="Loans"
        showBack
        right={<AddButton onPress={() => setModalVisible(true)} label="+ Loan" />}
      />

      {loadError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorTitle}>Couldn't load your loans</Text>
          <Text style={styles.errorDetail}>{loadError}</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={{ paddingBottom: theme.layout.screenScrollPad + insets.bottom }}>
        <LoansHero totals={totals} loading={loading} />
        {loading ? (
          [0, 1].map((i) => (
            <View key={i} style={[styles.card, { backgroundColor: theme.colors.surface }]}>
              <Skeleton width={140} height={14} radius={4} />
              <Skeleton width={100} height={10} radius={4} style={{ marginTop: 8 }} />
              <Skeleton width={220} height={6} radius={3} style={{ marginTop: 12 }} />
            </View>
          ))
        ) : loans.length === 0 ? (
          <EmptyState title="No loans yet" subtitle="Add one and Yume works out the EMI schedule for you.">
            <PrimaryButton title="Add a loan" onPress={() => setModalVisible(true)} />
          </EmptyState>
        ) : (
          <>
            {activeLoans.map((loan) => (
              <MovingRow key={loan.id}>
                <LoanCard
                  loan={loan}
                  hue={hues[loan.id]}
                  progress={progress[loan.id]}
                  fadeStyle={listFadeStyle}
                  onPress={() => setSelectedLoan(loan)}
                  onPay={() => payLoan(loan)}
                />
              </MovingRow>
            ))}
            {timeline && timeline.rows.length > 1 && <LoanTimeline timeline={timeline} hues={hues} />}
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
                        fadeStyle={listFadeStyle}
                        onPress={() => setSelectedLoan(loan)}
                        onPay={() => payLoan(loan)}
                      />
                    </MovingRow>
                  ))}
              </>
            )}
          </>
        )}
      </ScrollView>

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
