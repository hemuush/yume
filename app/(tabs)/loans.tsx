import { useCallback, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listLoans } from '@/db/loans';
import { formatMoney } from '@/lib/money';
import { roundedMinor } from '@/lib/round';
import { Loan } from '@/types';
import { SegmentedControl } from '@/components/SegmentedControl';
import { EmptyState } from '@/components/EmptyState';
import { AddButton } from '@/components/AddButton';
import { AppHeader } from '@/components/AppHeader';
import { PeopleSection } from '@/features/people/PeopleSection';
import { theme } from '@/constants/theme';
import { useFadeIn } from '@/lib/useFadeIn';
import { useScreenLoad } from '@/lib/useScreenLoad';
import { styles } from '@/features/loans/loans.styles';
import { LoanCard } from '@/features/loans/LoanCard';
import { LoanDetailModal } from '@/features/loans/LoanDetailModal';
import { AddLoanModal } from '@/features/loans/AddLoanModal';

const SECTIONS: { label: string; value: 'loans' | 'people' }[] = [
  { label: 'Loans', value: 'loans' },
  { label: 'Friends & Family', value: 'people' },
];

/**
 * Formal loans and informal IOUs both answer "who owes whom", so they share
 * one tab as two segments rather than living in a tab and a buried menu.
 */
export default function LoansScreen() {
  const insets = useSafeAreaInsets();
  const [section, setSection] = useState<'loans' | 'people'>('loans');
  const [loans, setLoans] = useState<Loan[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const listFadeStyle = useFadeIn([loans]);

  const loadLoans = useCallback(async () => {
    setLoans(await listLoans());
  }, []);
  const { loaded, loadError, reload: load } = useScreenLoad(loadLoans);

  // A defaulted loan is still money owed (or owed to you) — excluding it
  // here (as a stricter 'active'-only filter previously did) would drop it
  // from the very totals meant to tell you what you still owe.
  // Sum the per-loan outstanding values already rounded to whole rupees (the
  // same figure each LoanCard shows) so the header total equals the list.
  const totalBorrowedOutstanding = loans
    .filter((l) => l.direction === 'borrowed' && l.status !== 'closed')
    .reduce((sum, l) => sum + roundedMinor(l.outstandingPrincipalMinor), 0);
  const totalLentOutstanding = loans
    .filter((l) => l.direction === 'lent' && l.status !== 'closed')
    .reduce((sum, l) => sum + roundedMinor(l.outstandingPrincipalMinor), 0);
  // Active loans need attention (a payment due, a rate to update); closed
  // ones are done and were previously sitting in the same list with the
  // same weight — a status tag was the only way to tell them apart.
  const activeLoans = loans.filter((l) => l.status !== 'closed');
  const closedLoans = loans.filter((l) => l.status === 'closed');

  if (!loaded && !loadError) {
    return (
      <View style={styles.container}>
        <AppHeader title="Borrowed & Lent" />
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.ink} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader title="Borrowed & Lent" />

      <View style={styles.sectionSwitch}>
        <SegmentedControl options={SECTIONS} value={section} onChange={setSection} />
      </View>

      {section === 'people' ? (
        <PeopleSection />
      ) : (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeading}>Loans with a schedule</Text>
            <AddButton onPress={() => setModalVisible(true)} label="+ Loan" />
          </View>

          {loadError && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorTitle}>Couldn't load your loans</Text>
              <Text style={styles.errorDetail}>{loadError}</Text>
            </View>
          )}

          <View style={styles.summaryRow}>
            <View style={styles.summaryText}>
              <Text style={styles.summaryLabel}>You owe</Text>
              <Text
                style={[styles.summaryValue, styles.summaryValueExpense]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {formatMoney(totalBorrowedOutstanding)}
              </Text>
            </View>
            <View style={styles.summaryText}>
              <Text style={styles.summaryLabel}>Owed to you</Text>
              <Text
                style={[styles.summaryValue, styles.summaryValueIncome]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {formatMoney(totalLentOutstanding)}
              </Text>
            </View>
          </View>

          <ScrollView
            contentContainerStyle={{ paddingBottom: theme.layout.tabScreenScrollPad + insets.bottom }}
          >
            {loans.length === 0 ? (
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
        </>
      )}

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
          onClose={() => setSelectedLoan(null)}
          onChanged={async () => {
            await load();
          }}
        />
      )}
    </View>
  );
}
