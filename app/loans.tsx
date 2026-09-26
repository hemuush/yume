import { useCallback, useState } from 'react';
import { View, ScrollView } from 'react-native';
import { Text } from '@/components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listLoans } from '@/db/loans';
import { roundedMinor } from '@/lib/round';
import { Loan } from '@/types';
import { EmptyState } from '@/components/EmptyState';
import { AddButton } from '@/components/AddButton';
import { AppHeader } from '@/components/AppHeader';
import { OwedSummary } from '@/components/OwedSummary';
import { Skeleton } from '@/components/Skeleton';
import { theme } from '@/constants/theme';
import { useFadeIn } from '@/lib/useFadeIn';
import { useScreenLoad } from '@/lib/useScreenLoad';
import { styles } from '@/features/loans/loans.styles';
import { LoanCard } from '@/features/loans/LoanCard';
import { LoanDetailModal } from '@/features/loans/LoanDetailModal';
import { AddLoanModal } from '@/features/loans/AddLoanModal';

/** What's still outstanding one way, summed from the whole-rupee figures each LoanCard shows. */
function outstanding(loans: Loan[], direction: Loan['direction']): number {
  return loans
    .filter((l) => l.direction === direction)
    .reduce((sum, l) => sum + roundedMinor(l.outstandingPrincipalMinor), 0);
}

/**
 * Formal loans with a schedule. Reached from the Plan tab's Loans tile, and
 * from Home's EMI rows, loan-due notifications and the Next Due widget via
 * /loans. Informal IOUs have their own screen (/people).
 */
export default function LoansScreen() {
  const insets = useSafeAreaInsets();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const listFadeStyle = useFadeIn([loans]);

  const loadLoans = useCallback(async () => {
    setLoans(await listLoans());
  }, []);
  const { loaded, loadError, reload: load } = useScreenLoad(loadLoans);
  const loading = !loaded && !loadError;

  // A defaulted loan is still money owed (or owed to you), so only closed
  // loans drop out of the totals. Closed ones also sit apart in the list.
  const activeLoans = loans.filter((l) => l.status !== 'closed');
  const closedLoans = loans.filter((l) => l.status === 'closed');

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

      <OwedSummary
        youOweMinor={outstanding(activeLoans, 'borrowed')}
        owedToYouMinor={outstanding(activeLoans, 'lent')}
        loading={loading}
      />

      <ScrollView contentContainerStyle={{ paddingBottom: theme.layout.screenScrollPad + insets.bottom }}>
        {loading ? (
          [0, 1].map((i) => (
            <View key={i} style={[styles.card, { backgroundColor: theme.colors.surface }]}>
              <Skeleton width={140} height={14} radius={4} />
              <Skeleton width={100} height={10} radius={4} style={{ marginTop: 8 }} />
              <Skeleton width={220} height={6} radius={3} style={{ marginTop: 12 }} />
            </View>
          ))
        ) : loans.length === 0 ? (
          <EmptyState title="No loans yet" subtitle="Tap + Loan to add one with an EMI schedule." />
        ) : (
          <>
            {activeLoans.map((loan) => (
              <LoanCard
                key={loan.id}
                loan={loan}
                fadeStyle={listFadeStyle}
                onPress={() => setSelectedLoan(loan)}
              />
            ))}
            {closedLoans.length > 0 && (
              <>
                <Text style={styles.closedDivider}>CLOSED</Text>
                {closedLoans.map((loan) => (
                  <LoanCard
                    key={loan.id}
                    loan={loan}
                    fadeStyle={listFadeStyle}
                    onPress={() => setSelectedLoan(loan)}
                    muted
                  />
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
        <LoanDetailModal loan={selectedLoan} onClose={() => setSelectedLoan(null)} onChanged={load} />
      )}
    </View>
  );
}
