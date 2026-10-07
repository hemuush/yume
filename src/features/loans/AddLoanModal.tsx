import { useEffect, useMemo, useState } from 'react';
import { View, Animated } from 'react-native';
import { Text } from '@/components/Text';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { createLoan } from '@/db/loans';
import { listAccounts, listCategories } from '@/db/ledger';
import { listPeople, PersonWithBalance } from '@/db/people';
import { calculateEmi } from '@/lib/loan';
import { formatMoney, toMinor } from '@/lib/money';
import { LoanDirection, LoanRateType, Account, Category } from '@/types';
import { FormInput } from '@/components/FormInput';
import { AmountField } from '@/components/AmountField';
import { SegmentedControl } from '@/components/SegmentedControl';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Chip } from '@/components/Chip';
import { ModalSheet } from '@/components/ModalSheet';
import { SheetCard } from '@/components/SheetCard';
import { modalFooterStyles as f, theme } from '@/constants/theme';
import { toLocalIsoDate, monthsBetweenIsoDates, addMonthsToIsoDate } from '@/lib/date';
import { DateField } from '@/components/DateField';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { OptionCards, CountStepper, Option } from './AddLoanParts';
import { styles } from './loans.styles';
import { errorMessage } from '@/lib/errorMessage';
import { DURATIONS } from '@/lib/motionTimings';
import { dayMonthYear } from '@/lib/dateLabels';
import { spendableAccountsOf } from '@/lib/account';
import { rateProblem, tenureProblem } from '@/lib/loanLimits';
import { useAccent } from '@/theme/AccentContext';

const RATE_TYPES: { label: string; value: LoanRateType }[] = [
  { label: 'Fixed', value: 'fixed' },
  { label: 'Floating', value: 'floating' },
];

const DIRECTIONS: Option<LoanDirection>[] = [
  { value: 'borrowed', title: 'I borrowed', sub: 'From a bank or a person', icon: 'bank-outline' },
  { value: 'lent', title: 'I lent', sub: 'Money someone owes me', icon: 'hand-coin-outline' },
];

const TIMINGS: Option<'new' | 'existing'>[] = [
  { value: 'new', title: 'Yes, record it', sub: 'The money moved just now', icon: 'swap-horizontal' },
  { value: 'existing', title: 'No, already done', sub: 'A loan already under way', icon: 'history' },
];

/** Tenure shortcuts, in years; the loan itself is stored in months. */
const TENURE_YEARS = [1, 3, 5, 10, 20];

/** "20 years", "1 year 6 months", "9 months" — a loan's length, for its interest line. */
function tenureLabel(months: number): string {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const y = years > 0 ? `${years} year${years === 1 ? '' : 's'}` : '';
  const m = rest > 0 ? `${rest} month${rest === 1 ? '' : 's'}` : '';
  return [y, m].filter(Boolean).join(' ');
}

export function AddLoanModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { accent } = useAccent();
  // Recomputed whenever the modal opens, not frozen at mount: the parent tab stays alive all session, so a
  // `useMemo(..., [])` would default new-loan dates to yesterday for anyone adding a loan after midnight.
  const [today, setToday] = useState(() => new Date());
  const [direction, setDirection] = useState<LoanDirection>('borrowed');
  const [counterparty, setCounterparty] = useState('');
  const [principal, setPrincipal] = useState('');
  const [rate, setRate] = useState('');
  const [rateType, setRateType] = useState<LoanRateType>('fixed');
  const [tenure, setTenure] = useState('');
  const [tenureCustom, setTenureCustom] = useState(false);
  // Optional, borrowed loans only: without it a home loan reads as pure debt in Tracked Balance/Net Worth
  // with nothing offsetting it, though it financed something worth as much or more.
  const [trackAsset, setTrackAsset] = useState(false);
  const [assetLabel, setAssetLabel] = useState('');
  const [assetValue, setAssetValue] = useState('');
  const [loanTiming, setLoanTiming] = useState<'new' | 'existing'>('new');
  const [alreadyPaid, setAlreadyPaid] = useState('0');
  const [startDate, setStartDate] = useState(() => toLocalIsoDate(today));
  // First EMI due date, separate from the disbursement date (lenders often leave a gap). Defaults to one
  // month after disbursement and follows it until the user edits it.
  const [emiTouched, setEmiTouched] = useState(false);
  const [emiStartDate, setEmiStartDate] = useState(() => addMonthsToIsoDate(toLocalIsoDate(today), 1));
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [people, setPeople] = useState<PersonWithBalance[]>([]);
  const [personId, setPersonId] = useState<string | null>(null);
  const [disbAccountId, setDisbAccountId] = useState<string | null>(null);
  const [repayAccountId, setRepayAccountId] = useState<string | null>(null);
  const [disbCategoryId, setDisbCategoryId] = useState<string | null>(null);
  const [disbFee, setDisbFee] = useState('');
  const [feeCategoryId, setFeeCategoryId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Two steps, not one long form: step 1 is what the loan is (amount, rate, tenure), step 2 how it started
  // (date, then a yes/no about recording a transaction), so fee / paid-count fields show only when relevant.
  const [wizardStep, setWizardStep] = useState<1 | 2>(1);
  // Step-2 progress segment cross-fades its colour, with the app's usual reduce-motion guard.
  const reduceMotion = useReduceMotion();
  const [step2Fill] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduceMotion) {
      step2Fill.setValue(wizardStep === 2 ? 1 : 0);
      return;
    }
    Animated.timing(step2Fill, {
      toValue: wizardStep === 2 ? 1 : 0,
      duration: DURATIONS.standard,
      useNativeDriver: true,
    }).start();
  }, [wizardStep, reduceMotion, step2Fill]);

  useEffect(() => {
    if (visible) {
      setWizardStep(1);
      setToday(new Date());
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    (async () => {
      try {
        const [accs, cats, ppl] = await Promise.all([listAccounts(), listCategories(), listPeople()]);
        setAccounts(accs);
        setCategories(cats);
        setPeople(ppl);
        // Never a savings account: the disbursement and EMIs are income and spending, which it can't take.
        const firstSpendable = spendableAccountsOf(accs)[0]?.id ?? null;
        setDisbAccountId((prev) => prev ?? firstSpendable);
        setRepayAccountId((prev) => prev ?? firstSpendable);
      } catch (e) {
        // Guarded: a failure here would leave accounts/categories empty, so submit() would reject with the
        // confusing "Pick an account and category" instead of the real error.
        setError(errorMessage(e));
      }
    })();
  }, [visible]);

  // Keeps the EMI-start default following the disbursement date until the
  // user deliberately edits the EMI date field itself.
  useEffect(() => {
    if (!emiTouched) setEmiStartDate(addMonthsToIsoDate(startDate, 1));
  }, [startDate, emiTouched]);

  const principalMinor = toMinor(parseFloat(principal || '0'));
  const rateBp = Math.round(parseFloat(rate || '0') * 100);
  const tenureMonths = parseInt(tenure || '0', 10);
  const alreadyPaidCount = parseInt(alreadyPaid || '0', 10);

  const disbursementCategories = useMemo(
    () => categories.filter((c) => c.kind === (direction === 'borrowed' ? 'income' : 'expense')),
    [categories, direction]
  );
  // The fee transaction is always an expense, whatever the direction: a borrowed loan's disbCategoryId is
  // an INCOME category, so it can't tag the fee (an expense would carry an income-kind category).
  const feeCategories = useMemo(() => categories.filter((c) => c.kind === 'expense'), [categories]);
  // Disbursement and EMI money move as real income/expense transactions (createTransaction / payInstallment
  // in src/db/loans.ts), which reject a savings account, so it isn't offered here either.
  const spendableAccounts = useMemo(() => spendableAccountsOf(accounts), [accounts]);

  // Loan disbursement and processing fee aren't a real spending/earning choice, so no category picker (it
  // would list Salary, Groceries, Fuel...); they're auto-tagged with the best-matching seeded category.
  useEffect(() => {
    if (!disbursementCategories.length) return;
    setDisbCategoryId((prev) =>
      prev && disbursementCategories.some((c) => c.id === prev)
        ? prev
        : // The built-in category for each side: money borrowed comes in as Loan Repayment (income); money
          // lent goes out as Friends & Family (expense), not whichever expense category sorts first.
          (disbursementCategories.find(
            (c) => c.isSystem && c.name === (direction === 'borrowed' ? 'Loan Repayment' : 'Friends & Family')
          )?.id ??
          disbursementCategories.find((c) => c.name === 'Miscellaneous')?.id ??
          disbursementCategories[0].id)
    );
  }, [disbursementCategories, direction]);

  useEffect(() => {
    if (!feeCategories.length) return;
    setFeeCategoryId((prev) =>
      prev && feeCategories.some((c) => c.id === prev)
        ? prev
        : (feeCategories.find((c) => c.name === 'Fees & Charges')?.id ?? feeCategories[0].id)
    );
  }, [feeCategories]);

  const previewEmi = useMemo(() => {
    if (principalMinor <= 0 || tenureMonths <= 0 || rateProblem(rateBp) || tenureProblem(tenureMonths))
      return 0;
    return calculateEmi(principalMinor, rateBp, tenureMonths);
  }, [principalMinor, rateBp, tenureMonths]);

  const reset = () => {
    setDirection('borrowed');
    setError(null);
    setCounterparty('');
    setPrincipal('');
    setRate('');
    setRateType('fixed');
    setTenure('');
    setTenureCustom(false);
    setTrackAsset(false);
    setAssetLabel('');
    setAssetValue('');
    setLoanTiming('new');
    setAlreadyPaid('0');
    setStartDate(toLocalIsoDate(today));
    setEmiTouched(false);
    setEmiStartDate(addMonthsToIsoDate(toLocalIsoDate(today), 1));
    setPersonId(null);
    setDisbCategoryId(null);
    setDisbFee('');
    setFeeCategoryId(null);
    setWizardStep(1);
  };

  const step1Invalid =
    !counterparty.trim() ||
    !Number.isFinite(principalMinor) ||
    principalMinor <= 0 ||
    !Number.isFinite(tenureMonths) ||
    tenureMonths <= 0 ||
    !Number.isFinite(rateBp) ||
    rateBp < 0;

  const nextStep = () => {
    setError(null);
    if (step1Invalid) {
      setError("Fill in who it's with, the amount, the tenure and a valid interest rate");
      return;
    }
    const limit = rateProblem(rateBp) ?? tenureProblem(tenureMonths);
    if (limit) {
      setError(limit);
      return;
    }
    setWizardStep(2);
  };

  const submit = async () => {
    setError(null);
    if (step1Invalid) {
      setError("Fill in who it's with, the amount, the tenure and a valid interest rate");
      return;
    }
    const limit = rateProblem(rateBp) ?? tenureProblem(tenureMonths);
    if (limit) {
      setError(limit);
      return;
    }
    if (loanTiming === 'new' && (!disbAccountId || !disbCategoryId)) {
      setError('Pick an account and category for the disbursement, or switch to "Already in progress"');
      return;
    }
    if (loanTiming === 'existing' && !repayAccountId) {
      setError('Pick which account future EMIs should come out of');
      return;
    }
    // Both branches share one date picker: a real disbursement date is often earlier than the day you enter
    // it into Yume (or than a sanction letter's print date), so "new" can't only mean "today".
    if (loanTiming === 'new' && emiStartDate < startDate) {
      setError('The first EMI is before the disbursement date');
      return;
    }
    if (loanTiming === 'existing' && (!Number.isFinite(alreadyPaidCount) || alreadyPaidCount < 0)) {
      setError('Enter how many EMIs are already paid, or 0');
      return;
    }
    if (loanTiming === 'existing' && alreadyPaidCount > tenureMonths) {
      setError(`The loan only has ${tenureMonths} EMIs, so ${alreadyPaidCount} can't be paid already`);
      return;
    }
    if (loanTiming === 'existing' && alreadyPaidCount > 0) {
      // The two numbers must agree: 50 installments paid from a start date 13 months ago is a mismatch
      // either way (a real loan got a next-due date 3 years out while active). Caught here, not downstream.
      const elapsedMonths = monthsBetweenIsoDates(startDate, toLocalIsoDate(today));
      if (alreadyPaidCount > elapsedMonths) {
        setError(
          `You said ${alreadyPaidCount} installments are already paid, but only about ${elapsedMonths} month${elapsedMonths === 1 ? '' : 's'} have passed since ${dayMonthYear(startDate)} — double-check the start date or the paid count.`
        );
        return;
      }
    }
    // A processing fee is only asked for on a borrowed loan, so a stale value from before switching to
    // "I lent" is ignored rather than recorded.
    const feeAmountMinor = direction === 'borrowed' && disbFee ? toMinor(parseFloat(disbFee)) : 0;
    if (!Number.isFinite(feeAmountMinor) || feeAmountMinor < 0) {
      setError('Enter a valid processing fee, or leave it blank');
      return;
    }
    if (feeAmountMinor > 0 && direction === 'borrowed' && !feeCategoryId) {
      setError('Pick a category for the processing fee');
      return;
    }
    // The value is optional here too — matching the same "loan asset" edit
    // modal on the detail screen — only validated when actually provided.
    let assetValueMinor: number | null = null;
    if (trackAsset && assetValue.trim()) {
      assetValueMinor = toMinor(parseFloat(assetValue));
      if (!Number.isFinite(assetValueMinor) || assetValueMinor <= 0) {
        setError('Enter a valid current value for the asset, or leave it blank for now');
        return;
      }
    }
    setSaving(true);
    try {
      await createLoan({
        direction,
        counterparty: counterparty.trim(),
        principalMinor,
        interestRateAnnualBp: rateBp,
        tenureMonths,
        startDate,
        emiStartDate: loanTiming === 'new' ? emiStartDate : undefined,
        rateType,
        personId,
        assetLabel: trackAsset ? assetLabel.trim() || 'Asset' : null,
        assetValueMinor: trackAsset ? assetValueMinor : null,
        alreadyPaidInstallments: loanTiming === 'existing' ? alreadyPaidCount : 0,
        linkedAccountId: loanTiming === 'existing' ? repayAccountId : null,
        disbursement:
          loanTiming === 'new' && disbAccountId && disbCategoryId
            ? {
                accountId: disbAccountId,
                categoryId: disbCategoryId,
                feeAmountMinor: feeAmountMinor > 0 ? feeAmountMinor : undefined,
                feeCategoryId: direction === 'borrowed' ? (feeCategoryId ?? undefined) : undefined,
              }
            : null,
      });
      reset();
      onCreated();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      footer={
        <View style={f.footerCol}>
          {error && <Text style={styles.errorText}>{error}</Text>}
          <View style={f.footerRow}>
            {wizardStep === 1 ? (
              <PrimaryButton title="Next" onPress={nextStep} style={f.footerBtn} />
            ) : (
              <>
                <PrimaryButton
                  title="Back"
                  variant="secondary"
                  onPress={() => setWizardStep(1)}
                  style={f.footerBtn}
                  disabled={saving}
                />
                <PrimaryButton
                  title={saving ? 'Saving…' : 'Create loan'}
                  onPress={submit}
                  disabled={saving}
                  style={f.footerBtn}
                />
              </>
            )}
          </View>
        </View>
      }
    >
      {/* The calm-sheets sign-off (Direction C): the loan as a live card —
          coral for money you borrow, mint for money you lend — with its EMI
          worked out as you type, in place of a separate estimate box. */}
      <SheetCard
        hue={direction === 'borrowed' ? theme.colors.idCoralDeep : theme.colors.secondary}
        icon={direction === 'borrowed' ? 'bank-outline' : 'hand-coin-outline'}
        kicker={[rate ? `${rate}%` : null, tenureMonths > 0 ? tenureLabel(tenureMonths) : null]
          .filter(Boolean)
          .join(' · ')}
        amount={formatMoney(Number.isFinite(principalMinor) && principalMinor > 0 ? principalMinor : 0)}
        title={counterparty.trim() || (direction === 'borrowed' ? 'New loan' : 'Money you lent')}
        meta={
          previewEmi > 0
            ? `EMI ${formatMoney(previewEmi)}/month · ${formatMoney(
                Math.max(0, previewEmi * tenureMonths - principalMinor)
              )} interest`
            : 'EMI shows once the amount, rate and tenure are in'
        }
      />
      <Text style={styles.wizardEyebrow}>
        STEP {wizardStep} OF 2 · {wizardStep === 1 ? "WHAT'S THE LOAN?" : 'HOW DID IT START?'}
      </Text>
      <View style={styles.progressRow}>
        <View style={styles.progressSeg} />
        <View style={styles.progressSeg}>
          <Animated.View
            style={[styles.progressSegOverlay, { backgroundColor: accent, opacity: step2Fill }]}
          />
        </View>
      </View>

      {wizardStep === 1 && (
        <>
          <OptionCards
            options={DIRECTIONS}
            value={direction}
            onChange={(next) => {
              setDirection(next);
              if (next === 'lent') setTrackAsset(false); // asset tracking only makes sense for a borrowed loan
            }}
          />
          <FormInput
            label={direction === 'borrowed' ? 'Lender (bank/person)' : 'Borrower (person)'}
            value={counterparty}
            onChangeText={setCounterparty}
            placeholder="e.g. HDFC Bank"
          />
          <AmountField
            label="Principal amount"
            value={principal}
            onChangeText={setPrincipal}
            placeholder="e.g. 500000"
          />
          <AmountField
            label="Annual interest rate (%)"
            value={rate}
            onChangeText={setRate}
            placeholder="e.g. 9.5"
          />
          <Text style={styles.fieldLabel}>Rate type</Text>
          <SegmentedControl options={RATE_TYPES} value={rateType} onChange={setRateType} />
          {rateType === 'floating' && (
            <Text style={styles.hintText}>When the rate changes, update it from the loan's menu.</Text>
          )}
          <Text style={styles.fieldLabel}>Tenure</Text>
          <View style={styles.chipRow}>
            {TENURE_YEARS.map((y) => (
              <Chip
                key={y}
                label={`${y} ${y === 1 ? 'yr' : 'yrs'}`}
                active={!tenureCustom && tenure === String(y * 12)}
                onPress={() => {
                  setTenureCustom(false);
                  setTenure(String(y * 12));
                }}
              />
            ))}
            <Chip label="Custom" active={tenureCustom} onPress={() => setTenureCustom(true)} />
          </View>
          {tenureCustom ? (
            <AmountField
              decimal={false}
              label="Tenure (months)"
              value={tenure}
              onChangeText={setTenure}
              placeholder="e.g. 60"
            />
          ) : (
            tenureMonths > 0 && <Text style={styles.hintText}>{tenureMonths} monthly EMIs</Text>
          )}

          {direction === 'borrowed' && (
            <>
              <View style={styles.endDateRow}>
                <Text style={styles.fieldLabel}>This loan financed something worth tracking</Text>
                <ToggleSwitch value={trackAsset} onChange={setTrackAsset} />
              </View>
              {trackAsset ? (
                <>
                  <FormInput
                    label="What is it?"
                    value={assetLabel}
                    onChangeText={setAssetLabel}
                    placeholder="e.g. Home, Car"
                  />
                  <AmountField
                    label="Current estimated value (optional)"
                    value={assetValue}
                    onChangeText={setAssetValue}
                    placeholder="e.g. 3500000"
                  />
                  <Text style={styles.hintText}>
                    Its value minus what's still owed counts toward your net worth. Add the value later if you
                    don't have it yet.
                  </Text>
                </>
              ) : (
                <Text style={styles.hintText}>
                  Leave off for a personal loan or card: it counts as plain debt.
                </Text>
              )}
            </>
          )}
        </>
      )}

      {wizardStep === 2 && (
        <>
          <Text style={styles.fieldLabel}>Should Yume record the money moving?</Text>
          <OptionCards options={TIMINGS} value={loanTiming} onChange={setLoanTiming} />

          <DateField
            label={loanTiming === 'new' ? 'Disbursement date' : 'First EMI period started on'}
            value={startDate}
            onChange={setStartDate}
          />
          <Text style={styles.hintText}>
            The day the money was paid out. Change it if you're catching up.
          </Text>

          {loanTiming === 'new' ? (
            <>
              <Text style={styles.fieldLabel}>
                {direction === 'borrowed' ? 'Deposit into' : 'Pay from'} account
              </Text>
              <View style={styles.chipRow}>
                {spendableAccounts.map((acc) => (
                  <Chip
                    key={acc.id}
                    label={acc.name}
                    active={disbAccountId === acc.id}
                    onPress={() => setDisbAccountId(acc.id)}
                  />
                ))}
              </View>
              {direction === 'borrowed' && (
                <>
                  <AmountField
                    label="Processing / documentation fees deducted (optional)"
                    value={disbFee}
                    onChangeText={setDisbFee}
                    placeholder="0"
                  />
                  <Text style={styles.hintText}>
                    Saved as its own expense on the same day. Leave at 0 if none.
                  </Text>
                </>
              )}

              <DateField
                label="First EMI due date"
                value={emiStartDate}
                onChange={(iso) => {
                  setEmiTouched(true);
                  setEmiStartDate(iso);
                }}
                minDate={startDate}
              />
              <Text style={styles.hintText}>Usually a month after the money is paid out.</Text>
            </>
          ) : (
            <>
              <Text style={styles.fieldLabel}>EMIs already paid</Text>
              <CountStepper
                label="EMIs paid"
                value={Number.isFinite(alreadyPaidCount) ? alreadyPaidCount : 0}
                max={tenureMonths > 0 ? tenureMonths : 600}
                onChange={(n) => setAlreadyPaid(String(n))}
              />
              <Text style={styles.fieldLabel}>Future EMIs come out of</Text>
              <View style={styles.chipRow}>
                {spendableAccounts.map((acc) => (
                  <Chip
                    key={acc.id}
                    label={acc.name}
                    active={repayAccountId === acc.id}
                    onPress={() => setRepayAccountId(acc.id)}
                  />
                ))}
              </View>
              <Text style={styles.hintText}>
                Nothing is recorded for money that moved before Yume. You can change the account later.
              </Text>
            </>
          )}

          {people.length > 0 && (
            <>
              <Text style={styles.fieldLabel}>Link to a person (optional)</Text>
              <View style={styles.chipRow}>
                <Chip label="None" active={personId === null} onPress={() => setPersonId(null)} />
                {people.map((p) => (
                  <Chip
                    key={p.id}
                    label={p.name}
                    active={personId === p.id}
                    onPress={() => setPersonId(p.id)}
                  />
                ))}
              </View>
            </>
          )}
        </>
      )}
    </ModalSheet>
  );
}
