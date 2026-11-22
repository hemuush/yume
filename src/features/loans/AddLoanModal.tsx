import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Animated } from 'react-native';
import { Text } from '@/components/Text';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { createLoan } from '@/db/loans';
import { listAccounts, listCategories } from '@/db/ledger';
import { listPeople, PersonWithBalance } from '@/db/people';
import { calculateEmi } from '@/lib/loan';
import { formatMoney, toWholeMinor } from '@/lib/money';
import { LoanDirection, LoanRateType, Account, Category } from '@/types';
import { FormInput } from '@/components/FormInput';
import { AmountField } from '@/components/AmountField';
import { SheetTabs } from '@/components/SheetTabs';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Chip } from '@/components/Chip';
import { ModalSheet } from '@/components/ModalSheet';
import { DraftCard } from '@/components/DraftCard';
import { modalFooterStyles as f, theme } from '@/constants/theme';
import { toLocalIsoDate, monthsBetweenIsoDates, addMonthsToIsoDate } from '@/lib/date';
import { DateField } from '@/components/DateField';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { OptionCards, CountStepper, Option } from './AddLoanParts';
import { buildLoanInput, problemWithLoanBasics, type LoanSetupForm } from './loanSetup';
import { styles } from './loans.styles';
import { errorMessage } from '@/lib/errorMessage';
import { DURATIONS, EASE_OUT } from '@/lib/motionTimings';
import { spendableAccountsOf, defaultCurrencyAccountsOf } from '@/lib/account';
import { rateProblem, tenureProblem } from '@/lib/loanLimits';
import { useAccent } from '@/theme/AccentContext';
import { useSaveOnce } from '@/hooks/useSaveOnce';

const RATE_TYPES: { label: string; value: LoanRateType }[] = [
  { label: 'Fixed', value: 'fixed' },
  { label: 'Floating', value: 'floating' },
];

const DIRECTIONS: Option<LoanDirection>[] = [
  { value: 'borrowed', title: 'I borrowed', sub: 'From a bank or a person', icon: 'bank-outline' },
  { value: 'lent', title: 'I lent', sub: 'Money someone owes me', icon: 'hand-coin-outline' },
];

const TIMINGS: Option<'new' | 'existing'>[] = [
  { value: 'new', title: 'New loan', sub: 'Money moves now; Yume records it', icon: 'swap-horizontal' },
  { value: 'existing', title: 'Already running', sub: 'Started earlier; nothing recorded', icon: 'history' },
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
  ledgerStyle,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  ledgerStyle?: boolean;
  onCreated: () => void;
}) {
  const { accent } = useAccent();
  // Recomputed whenever the modal opens, not frozen at mount: the parent tab stays alive all session, so a
  // `useMemo(..., [])` would default new-loan dates to yesterday for anyone adding a loan after midnight.
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
  const [startDate, setStartDate] = useState(() => toLocalIsoDate(new Date()));
  const startDateTouched = useRef(false);
  // The EMIs-paid count follows the start date (months gone by, never past the tenure) until it is set by hand.
  const paidTouched = useRef(false);
  // First EMI due date, separate from the disbursement date (lenders often leave a gap). Defaults to one
  // month after disbursement and follows it until the user edits it.
  const [emiTouched, setEmiTouched] = useState(false);
  const [emiStartDate, setEmiStartDate] = useState(() => addMonthsToIsoDate(toLocalIsoDate(new Date()), 1));
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
      easing: EASE_OUT,
      useNativeDriver: true,
    }).start();
  }, [wizardStep, reduceMotion, step2Fill]);

  useEffect(() => {
    if (visible) {
      setWizardStep(1);
      const now = new Date();
      if (!startDateTouched.current) setStartDate(toLocalIsoDate(now));
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    let live = true;
    void (async () => {
      try {
        const [accs, cats, ppl] = await Promise.all([listAccounts(), listCategories(), listPeople()]);
        if (!live) return;
        const eligible = defaultCurrencyAccountsOf(accs);
        setAccounts(eligible);
        setCategories(cats);
        setPeople(ppl);
        // Never a savings account: the disbursement and EMIs are income and spending, which it can't take.
        const firstSpendable = spendableAccountsOf(eligible)[0]?.id ?? null;
        setDisbAccountId((prev) => prev ?? firstSpendable);
        setRepayAccountId((prev) => prev ?? firstSpendable);
      } catch (e) {
        // Guarded: a failure here would leave accounts/categories empty, so submit() would reject with the
        // confusing "Pick an account and category" instead of the real error.
        if (live) setError(errorMessage(e));
      }
    })();
    return () => {
      live = false;
    };
  }, [visible]);

  // Keeps the EMI-start default following the disbursement date until the
  // user deliberately edits the EMI date field itself.
  useEffect(() => {
    if (!emiTouched) setEmiStartDate(addMonthsToIsoDate(startDate, 1));
  }, [startDate, emiTouched]);

  const principalMinor = toWholeMinor(parseFloat(principal || '0'));
  const rateBp = Math.round(parseFloat(rate || '0') * 100);
  const tenureMonths = parseInt(tenure || '0', 10);
  const alreadyPaidCount = parseInt(alreadyPaid || '0', 10);

  useEffect(() => {
    if (loanTiming !== 'existing' || paidTouched.current) return;
    const gone = Math.max(0, monthsBetweenIsoDates(startDate, toLocalIsoDate(new Date())));
    setAlreadyPaid(String(tenureMonths > 0 ? Math.min(gone, tenureMonths) : gone));
  }, [loanTiming, startDate, tenure]); // eslint-disable-line react-hooks/exhaustive-deps

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
    startDateTouched.current = false;
    paidTouched.current = false;
    const now = toLocalIsoDate(new Date());
    setStartDate(now);
    setEmiTouched(false);
    setEmiStartDate(addMonthsToIsoDate(now, 1));
    setPersonId(null);
    setDisbCategoryId(null);
    setDisbFee('');
    setFeeCategoryId(null);
    setWizardStep(1);
  };

  const form: LoanSetupForm = {
    direction,
    counterparty,
    principalMinor,
    rateBp,
    tenureMonths,
    rateType,
    personId,
    loanTiming,
    startDate,
    emiStartDate,
    alreadyPaidCount,
    disbAccountId,
    disbCategoryId,
    disbFee,
    feeCategoryId,
    repayAccountId,
    trackAsset,
    assetLabel,
    assetValue,
  };

  const nextStep = () => {
    setError(null);
    const problem = problemWithLoanBasics(form);
    if (problem) {
      setError(problem);
      return;
    }
    setWizardStep(2);
  };

  const submit = async () => {
    setError(null);
    const built = buildLoanInput(form, toLocalIsoDate(new Date()));
    if ('error' in built) {
      setError(built.error);
      return;
    }
    setSaving(true);
    try {
      await createLoan(built.input);
      reset();
      onCreated();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };
  const submitOnce = useSaveOnce(submit);

  return (
    <ModalSheet
      ledgerStyle={ledgerStyle}
      dismissible={!saving}
      title="Loan setup"
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
                  loading={saving}
                  title={saving ? 'Saving…' : 'Create loan'}
                  onPress={submitOnce}
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
      <DraftCard
        hue={direction === 'borrowed' ? theme.colors.idCoralDeep : theme.colors.secondary}
        icon={direction === 'borrowed' ? 'bank-outline' : 'hand-coin-outline'}
        title={counterparty.trim() || (direction === 'borrowed' ? 'New loan' : 'Money you lent')}
        kicker={[rate ? `${rate}%` : null, tenureMonths > 0 ? tenureLabel(tenureMonths) : null]
          .filter(Boolean)
          .join(' · ')}
        figure={previewEmi > 0 ? formatMoney(previewEmi) : undefined}
        per="a month"
        meta={
          previewEmi > 0
            ? `${formatMoney(Math.max(0, previewEmi * tenureMonths - principalMinor))} interest over the term`
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
            onChangeText={(text) => {
              setCounterparty(text);
              // A person stays linked only while their name is what is written.
              if (personId && people.find((x) => x.id === personId)?.name !== text) setPersonId(null);
            }}
            placeholder="e.g. HDFC Bank"
            autoCapitalize="words"
          />
          {people.length > 0 && (
            <View style={styles.chipRow}>
              {people.map((p) => (
                <Chip
                  key={p.id}
                  label={p.name}
                  active={personId === p.id}
                  onPress={() => {
                    setPersonId(p.id);
                    setCounterparty(p.name);
                  }}
                />
              ))}
            </View>
          )}
          <AmountField
            label="Principal amount"
            value={principal}
            onChangeText={setPrincipal}
            placeholder="e.g. 500000"
          />
          <View style={styles.pairRow}>
            <View style={styles.pairCell}>
              <AmountField
                label="Annual interest rate (%)"
                value={rate}
                onChangeText={setRate}
                placeholder="e.g. 9.5"
              />
            </View>
            <View style={styles.pairCell}>
              <Text style={styles.fieldLabel}>Rate type</Text>
              <SheetTabs options={RATE_TYPES} value={rateType} onChange={setRateType} />
            </View>
          </View>
          {rateType === 'floating' && (
            <Text style={styles.hintText}>When the rate changes, update it from the loan’s menu.</Text>
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
          ) : null}

          {direction === 'borrowed' && (
            <>
              <View style={styles.assetRow}>
                <View style={styles.assetCopy}>
                  <Text style={styles.assetTitle}>Track what it paid for</Text>
                  <Text style={styles.assetHint}>
                    {trackAsset
                      ? 'Its value minus what’s still owed counts toward your net worth.'
                      : 'Leave off for a personal loan or card: it counts as plain debt.'}
                  </Text>
                </View>
                <ToggleSwitch value={trackAsset} onChange={setTrackAsset} />
              </View>
              {trackAsset && (
                <View style={styles.pairRow}>
                  <View style={styles.pairCell}>
                    <FormInput
                      label="What is it?"
                      value={assetLabel}
                      onChangeText={setAssetLabel}
                      placeholder="e.g. Home, Car"
                    />
                  </View>
                  <View style={styles.pairCell}>
                    <AmountField
                      label="Current estimated value (optional)"
                      value={assetValue}
                      onChangeText={setAssetValue}
                      placeholder="e.g. 3500000"
                    />
                  </View>
                </View>
              )}
            </>
          )}
        </>
      )}

      {wizardStep === 2 && (
        <>
          <Text style={styles.fieldLabel}>Is this loan new, or already running?</Text>
          <OptionCards options={TIMINGS} value={loanTiming} onChange={setLoanTiming} />

          {loanTiming === 'new' ? (
            <>
              <View style={styles.pairRow}>
                <View style={styles.pairCell}>
                  <DateField
                    label="Disbursement date"
                    value={startDate}
                    onChange={(iso) => {
                      startDateTouched.current = true;
                      setStartDate(iso);
                    }}
                  />
                </View>
                <View style={styles.pairCell}>
                  <DateField
                    label="First EMI due date"
                    value={emiStartDate}
                    onChange={(iso) => {
                      setEmiTouched(true);
                      setEmiStartDate(iso);
                    }}
                    minDate={startDate}
                  />
                </View>
              </View>
              <Text style={styles.hintText}>
                Change the dates if you’re catching up. The first EMI is usually a month after the money is
                paid out.
              </Text>
              <Text style={styles.fieldLabel}>
                {direction === 'borrowed' ? 'Deposit into' : 'Pay from'} account
              </Text>
              {spendableAccounts.length === 0 && (
                <Text style={styles.hintText}>
                  Add a bank or cash account first: the loan’s money moves through one.
                </Text>
              )}
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
                  <Text style={styles.hintText}>Saved as its own expense on the same day.</Text>
                </>
              )}
            </>
          ) : (
            <>
              <View style={styles.pairRow}>
                <View style={styles.pairCell}>
                  <DateField
                    label="First EMI period started on"
                    value={startDate}
                    onChange={(iso) => {
                      startDateTouched.current = true;
                      setStartDate(iso);
                    }}
                  />
                </View>
                <View style={styles.pairCell}>
                  <Text style={styles.fieldLabel}>EMIs already paid</Text>
                  <CountStepper
                    label="EMIs paid"
                    value={Number.isFinite(alreadyPaidCount) ? alreadyPaidCount : 0}
                    max={tenureMonths > 0 ? tenureMonths : 600}
                    onChange={(n) => {
                      paidTouched.current = true;
                      setAlreadyPaid(String(n));
                    }}
                  />
                </View>
              </View>
              <Text style={styles.fieldLabel}>
                {direction === 'lent' ? 'Future repayments arrive in' : 'Future EMIs come out of'}
              </Text>
              {spendableAccounts.length === 0 && (
                <Text style={styles.hintText}>
                  Add a bank or cash account first: the loan’s money moves through one.
                </Text>
              )}
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
        </>
      )}
    </ModalSheet>
  );
}
