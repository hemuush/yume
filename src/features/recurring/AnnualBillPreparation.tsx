import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Text } from '@/components/Text';
import { Chip } from '@/components/Chip';
import { PrimaryButton } from '@/components/PrimaryButton';
import { RecurringRule, Account, SavingsGoal } from '@/types';
import { getAnnualBillGoal, prepareAnnualBill, unlinkAnnualBill, annualPreparation } from '@/db/annualBills';
import { listSavingsGoals } from '@/db/savingsGoals';
import { useSaveOnce } from '@/lib/useSaveOnce';
import { toLocalIsoDate } from '@/lib/date';
import { dayMonthYear } from '@/lib/dateLabels';
import { formatMaskableMoney } from '@/lib/money';
import { usePrivacy } from '@/theme/PrivacyContext';
import { errorMessage } from '@/lib/errorMessage';
import { styles } from './recurring.styles';
import { InsightHeader, InsightStat, InsightRow, InsightDisclosure, insight } from '@/components/InsightCard';
export function AnnualBillPreparation({
  rule,
  accounts,
  onNavigate,
}: {
  rule: RecurringRule;
  accounts: Account[];
  onNavigate: () => void;
}) {
  const [goal, setGoal] = useState<Awaited<ReturnType<typeof getAnnualBillGoal>>>(null);
  const [goals, setGoals] = useState<SavingsGoal[]>([]),
    [revision, setRevision] = useState(0);
  const [accountId, setAccountId] = useState<string | null>(null),
    [goalId, setGoalId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false);
  const { hideAmounts } = usePrivacy();
  const eligible = accounts.filter(
    (a) =>
      !a.archived &&
      !a.investment &&
      a.type !== 'credit_card' &&
      a.currency === accounts.find((a) => a.id === rule.accountId)?.currency
  );
  useEffect(() => {
    let live = true;
    setLoaded(false);
    setError(null);
    Promise.all([getAnnualBillGoal(rule.id), listSavingsGoals()])
      .then(([g, gs]) => {
        if (live) {
          setGoal(g);
          setGoals(gs.filter((g) => g.reservesAccount));
          setLoaded(true);
        }
      })
      .catch((e) => {
        if (live) {
          setError(errorMessage(e));
          setLoaded(true);
        }
      });
    return () => {
      live = false;
    };
  }, [rule.id, revision]);
  const run = useSaveOnce(async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      setRevision((v) => v + 1);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  });
  const plan = annualPreparation(
    rule.amountMinor,
    goal?.reserved_amount_minor ?? 0,
    rule.nextRunDate,
    toLocalIsoDate(new Date())
  );
  const money = (minor: number) => formatMaskableMoney(minor, { masked: hideAmounts });
  return (
    <View style={insight.card}>
      <InsightHeader
        title="Prepare for renewal"
        subtitle={`Next bill · ${dayMonthYear(rule.nextRunDate)}`}
        icon="calendar"
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
      {error && !busy ? (
        <PrimaryButton
          compact
          variant="secondary"
          title="Retry preparation"
          onPress={() => setRevision((v) => v + 1)}
        />
      ) : !loaded ? (
        <Text style={styles.modalHint}>Checking preparation goal…</Text>
      ) : goal ? (
        <>
          <View style={insight.facts}>
            <InsightStat label="Set aside" value={money(goal.reserved_amount_minor)} />
            <InsightStat label="Still needed" value={money(plan.remainingMinor)} />
          </View>
          <Text style={styles.modalHint}>
            {!rule.active
              ? 'This bill is paused.'
              : plan.overdue
                ? 'Payment is overdue. Review the amount needed now.'
                : !hideAmounts && plan.remainingMinor === 0
                  ? 'No additional reservation needed for this bill amount.'
                  : `${money(plan.perMonthMinor)} a month across ${plan.months} month${plan.months === 1 ? '' : 's'} to prepare.`}
          </Text>
          <InsightRow
            label={goal.name}
            detail={goal.archived ? 'Archived · reservation retained' : 'Open preparation goal'}
            value={money(goal.reserved_amount_minor)}
            onPress={() => {
              onNavigate();
              router.push(`/savings-goals?goal=${goal.id}`);
            }}
          />
          <InsightDisclosure title="Manage preparation">
            <PrimaryButton
              compact
              variant="secondary"
              title="Unlink preparation goal"
              disabled={busy}
              onPress={() => void run(() => unlinkAnnualBill(rule.id))}
            />
            <Text style={styles.modalHint}>
              Unlinking leaves the goal and its reservation intact. After paying the bill, release or adjust
              its reservation before preparing again. Bill edits do not silently change goal targets.
            </Text>
          </InsightDisclosure>
        </>
      ) : (
        <>
          <View style={insight.facts}>
            <InsightStat
              label={plan.overdue ? 'Needed now' : 'Set aside each month'}
              value={money(plan.overdue ? plan.remainingMinor : plan.perMonthMinor)}
            />
            <InsightStat label="Annual bill" value={money(rule.amountMinor)} />
          </View>
          <Text style={insight.caption}>Choose where to prepare. Money stays in your account.</Text>
          {!eligible.length && !goals.length && (
            <Text style={styles.modalHint}>
              Add an eligible funding account in Profile to prepare for this bill.
            </Text>
          )}
          {!rule.active ? (
            <Text style={insight.caption}>Resume this recurring entry before setting up preparation.</Text>
          ) : (
            <InsightDisclosure title="Set up preparation">
              {goals.length > 0 && <Text style={styles.fieldLabel}>Use an existing goal</Text>}
              <View style={styles.chipRow}>
                {goals.map((g) => (
                  <Chip
                    key={g.id}
                    label={g.name}
                    active={goalId === g.id}
                    onPress={() => {
                      setGoalId(g.id);
                      setAccountId(null);
                    }}
                  />
                ))}
              </View>
              <Text style={styles.fieldLabel}>Or create a goal in</Text>
              <View style={styles.chipRow}>
                {eligible.map((a) => (
                  <Chip
                    key={a.id}
                    label={a.name}
                    active={accountId === a.id}
                    onPress={() => {
                      setAccountId(a.id);
                      setGoalId(null);
                    }}
                  />
                ))}
              </View>
              <PrimaryButton
                title={goalId ? 'Link reservation goal' : 'Create preparation goal'}
                disabled={busy || (!goalId && !accountId)}
                onPress={() =>
                  void run(() => prepareAnnualBill(rule.id, goalId ? { goalId } : { accountId: accountId! }))
                }
              />
            </InsightDisclosure>
          )}
        </>
      )}
    </View>
  );
}
