import { useEffect, useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import { createLoan } from '@/db/loans';
import { listAccounts, listCategories } from '@/db/ledger';
import { listPeople, PersonWithBalance } from '@/db/people';
import { calculateEmi } from '@/lib/loan';
import { formatMoney, toMinor } from '@/lib/money';
import { LoanDirection, LoanRateType, Account, Category } from '@/types';
import { FormInput } from '@/components/FormInput';
import { SegmentedControl } from '@/components/SegmentedControl';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Chip } from '@/components/Chip';
import { ModalSheet } from '@/components/ModalSheet';
import { modalFooterStyles as f, theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';
import {
  toLocalIsoDate,
  monthsBetweenIsoDates,
  partsToIsoDate,
  parseLocalIsoDate,
  addMonthsToIsoDate,
} from '@/lib/date';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { styles } from './loans.styles';

const RATE_TYPES: { label: string; value: LoanRateType }[] = [
  { label: 'Fixed', value: 'fixed' },
  { label: 'Floating', value: 'floating' },
];

const DIRECTIONS: { label: string; value: LoanDirection }[] = [
  { label: 'I Borrowed', value: 'borrowed' },
  { label: 'I Lent', value: 'lent' },
];

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
  // Recomputed whenever the modal opens (below), not frozen at first mount —
  // this modal's parent screen is a tab that stays alive all session, so a
  // `useMemo(..., [])` here would keep defaulting new-loan dates to
  // yesterday for anyone who opens the app before midnight and adds a loan
  // after.
  const [today, setToday] = useState(() => new Date());
  const [direction, setDirection] = useState<LoanDirection>('borrowed');
  const [counterparty, setCounterparty] = useState('');
  const [principal, setPrincipal] = useState('');
  const [rate, setRate] = useState('');
  const [rateType, setRateType] = useState<LoanRateType>('fixed');
  const [tenure, setTenure] = useState('');
  // Optional — only offered for a borrowed loan. Without this, a home loan
  // permanently reads as pure debt in Tracked Balance/Net Worth with
  // nothing offsetting it, even though it financed something real worth
  // just as much (or more) than what's still owed.
  const [trackAsset, setTrackAsset] = useState(false);
  const [assetLabel, setAssetLabel] = useState('');
  const [assetValue, setAssetValue] = useState('');
  const [loanTiming, setLoanTiming] = useState<'new' | 'existing'>('new');
  const [alreadyPaid, setAlreadyPaid] = useState('0');
  const [startYear, setStartYear] = useState(String(today.getFullYear()));
  const [startMonth, setStartMonth] = useState(String(today.getMonth() + 1));
  const [startDay, setStartDay] = useState(String(today.getDate()));
  // First EMI due date, separate from the disbursement date above — real
  // lenders routinely leave a gap between the two. Defaults to one month
  // after the disbursement date and re-derives automatically until the user
  // actually edits it, at which point it stops following the disbursement
  // date around.
  const [emiTouched, setEmiTouched] = useState(false);
  const emiDefault = useMemo(() => addMonthsToIsoDate(toLocalIsoDate(today), 1), [today]);
  const emiDefaultParts = parseLocalIsoDate(emiDefault);
  const [emiYear, setEmiYear] = useState(String(emiDefaultParts.getFullYear()));
  const [emiMonth, setEmiMonth] = useState(String(emiDefaultParts.getMonth() + 1));
  const [emiDay, setEmiDay] = useState(String(emiDefaultParts.getDate()));
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
  // Two steps instead of one long scrolling form: step 1 is purely "what is
  // this loan" (amount, rate, tenure), step 2 is purely "how did it start"
  // (date, then a plain yes/no about recording a transaction). Nobody who
  // doesn't need a processing fee or already-paid count has to see those
  // fields before they're relevant.
  const [wizardStep, setWizardStep] = useState<1 | 2>(1);

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
        setDisbAccountId((prev) => prev ?? accs[0]?.id ?? null);
        setRepayAccountId((prev) => prev ?? accs[0]?.id ?? null);
      } catch (e: any) {
        // Previously unguarded — a failure here silently left accounts and
        // categories empty, so submit() would reject with the confusing
        // "Pick an account and category" validation message instead of the
        // real underlying error.
        setError(String(e?.message ?? e));
      }
    })();
  }, [visible]);

  // Keeps the EMI-start default following the disbursement date until the
  // user deliberately edits the EMI date field itself.
  useEffect(() => {
    if (emiTouched) return;
    const disb = partsToIsoDate(startYear, startMonth, startDay);
    if (!disb) return;
    const next = addMonthsToIsoDate(disb, 1);
    const d = parseLocalIsoDate(next);
    setEmiYear(String(d.getFullYear()));
    setEmiMonth(String(d.getMonth() + 1));
    setEmiDay(String(d.getDate()));
  }, [startYear, startMonth, startDay, emiTouched]);

  const principalMinor = toMinor(parseFloat(principal || '0'));
  const rateBp = Math.round(parseFloat(rate || '0') * 100);
  const tenureMonths = parseInt(tenure || '0', 10);
  const alreadyPaidCount = parseInt(alreadyPaid || '0', 10);

  const disbursementCategories = useMemo(
    () => categories.filter((c) => c.kind === (direction === 'borrowed' ? 'income' : 'expense')),
    [categories, direction]
  );
  // The processing-fee transaction is always an expense regardless of loan
  // direction — for a borrowed loan, disbCategoryId is an INCOME category
  // (matching the disbursement itself), so it can't also tag the fee, or an
  // expense would end up carrying an income-kind category.
  const feeCategories = useMemo(() => categories.filter((c) => c.kind === 'expense'), [categories]);

  // A loan disbursement or its processing fee isn't a real spending/earning
  // choice the way "Groceries" vs "Entertainment" is — asking the user to
  // pick from the full category list here just surfaced irrelevant options
  // (Salary, Groceries, Fuel...) for a transaction that's really always the
  // same kind of thing. Auto-tagged with the best-matching seeded category
  // instead, with no picker shown at all.
  useEffect(() => {
    if (!disbursementCategories.length) return;
    setDisbCategoryId((prev) =>
      prev && disbursementCategories.some((c) => c.id === prev)
        ? prev
        : (disbursementCategories.find((c) => c.name === 'Loan Repayment')?.id ??
          disbursementCategories[0].id)
    );
  }, [disbursementCategories]);

  useEffect(() => {
    if (!feeCategories.length) return;
    setFeeCategoryId((prev) =>
      prev && feeCategories.some((c) => c.id === prev)
        ? prev
        : (feeCategories.find((c) => c.name === 'Fees & Charges')?.id ?? feeCategories[0].id)
    );
  }, [feeCategories]);

  const previewEmi = useMemo(() => {
    if (principalMinor <= 0 || tenureMonths <= 0) return 0;
    return calculateEmi(principalMinor, rateBp, tenureMonths);
  }, [principalMinor, rateBp, tenureMonths]);

  const reset = () => {
    setCounterparty('');
    setPrincipal('');
    setRate('');
    setRateType('fixed');
    setTenure('');
    setTrackAsset(false);
    setAssetLabel('');
    setAssetValue('');
    setLoanTiming('new');
    setAlreadyPaid('0');
    setStartYear(String(today.getFullYear()));
    setStartMonth(String(today.getMonth() + 1));
    setStartDay(String(today.getDate()));
    setEmiTouched(false);
    const d = parseLocalIsoDate(addMonthsToIsoDate(toLocalIsoDate(today), 1));
    setEmiYear(String(d.getFullYear()));
    setEmiMonth(String(d.getMonth() + 1));
    setEmiDay(String(d.getDate()));
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
      setError('Fill in counterparty, principal, tenure, and a valid interest rate');
      return;
    }
    setWizardStep(2);
  };

  const submit = async () => {
    setError(null);
    if (step1Invalid) {
      setError('Fill in counterparty, principal, tenure, and a valid interest rate');
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
    // Both branches now share one date picker — a real disbursement date is
    // routinely earlier than the day you get around to entering it into
    // Yume (or even earlier than a sanction letter's own print date), so
    // "new" can no longer only mean "today."
    const startDate = partsToIsoDate(startYear, startMonth, startDay);
    if (!startDate) {
      setError('Enter a valid loan start date');
      return;
    }
    const emiStartDate = partsToIsoDate(emiYear, emiMonth, emiDay);
    if (loanTiming === 'new' && !emiStartDate) {
      setError('Enter a valid first EMI due date');
      return;
    }
    if (loanTiming === 'existing' && alreadyPaidCount > 0) {
      // The two numbers must agree with each other: claiming 50 installments
      // already paid from a start date only 13 months ago is a mismatch no
      // matter which figure is wrong — this is exactly how a real loan
      // ended up with its "next due" installment calculated 3 years in the
      // future while still showing as active. Caught here instead of only
      // downstream in a confusing due-date display.
      const elapsedMonths = monthsBetweenIsoDates(startDate, toLocalIsoDate(today));
      if (alreadyPaidCount > elapsedMonths) {
        setError(
          `You said ${alreadyPaidCount} installments are already paid, but only about ${elapsedMonths} month${elapsedMonths === 1 ? '' : 's'} have passed since ${startDate} — double-check the start date or the paid count.`
        );
        return;
      }
    }
    const feeAmountMinor = disbFee ? toMinor(parseFloat(disbFee)) : 0;
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
        emiStartDate: loanTiming === 'new' ? (emiStartDate ?? undefined) : undefined,
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
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      title="New Loan"
      footer={
        <View style={f.footerCol}>
          {error && <Text style={styles.errorText}>{error}</Text>}
          <View style={f.footerRow}>
            {wizardStep === 1 ? (
              <>
                <PrimaryButton title="Cancel" variant="secondary" onPress={onClose} style={f.footerBtn} />
                <PrimaryButton title="Next" onPress={nextStep} style={f.footerBtn} />
              </>
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
                  title={saving ? 'Saving...' : 'Create loan'}
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
      <Text style={styles.wizardEyebrow}>
        STEP {wizardStep} OF 2 · {wizardStep === 1 ? "WHAT'S THE LOAN?" : 'HOW DID IT START?'}
      </Text>
      <View style={styles.progressRow}>
        <View style={styles.progressSeg} />
        <View style={[styles.progressSeg, wizardStep === 2 && styles.progressSegDone]} />
      </View>

      {wizardStep === 1 && (
        <>
          <SegmentedControl
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
          <FormInput
            label="Principal amount"
            value={principal}
            onChangeText={setPrincipal}
            keyboardType="numeric"
            placeholder="e.g. 500000"
          />
          <FormInput
            label="Annual interest rate (%)"
            value={rate}
            onChangeText={setRate}
            keyboardType="numeric"
            placeholder="e.g. 9.5"
          />
          <Text style={styles.fieldLabel}>Rate type</Text>
          <SegmentedControl options={RATE_TYPES} value={rateType} onChange={setRateType} />
          {rateType === 'floating' && (
            <Text style={styles.hintText}>
              When your bank changes the rate, open this loan and use "Update rate" to re-calculate the
              remaining schedule.
            </Text>
          )}
          <FormInput
            label="Tenure (months)"
            value={tenure}
            onChangeText={setTenure}
            keyboardType="numeric"
            placeholder="e.g. 60"
          />

          {previewEmi > 0 && (
            <View style={[styles.emiPreview, { backgroundColor: accent + '22', borderColor: accent }]}>
              <Text style={[styles.emiPreviewLabel, { color: theme.colors.textSecondary }]}>
                Estimated EMI
              </Text>
              <Text style={[styles.emiPreviewValue, { color: theme.colors.textPrimary }]}>
                {formatMoney(previewEmi)}/month
              </Text>
            </View>
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
                  <FormInput
                    label="Current estimated value (optional)"
                    value={assetValue}
                    onChangeText={setAssetValue}
                    keyboardType="numeric"
                    placeholder="e.g. 3500000"
                  />
                  <Text style={styles.hintText}>
                    Leave the value blank if you don't have an estimate yet — add one anytime from the loan's
                    own screen. Once set, its value minus what's still owed counts toward Tracked Balance/Net
                    Worth, instead of just the debt with nothing offsetting it.
                  </Text>
                </>
              ) : (
                <Text style={styles.hintText}>
                  Leave off for a loan with no real asset behind it (personal loan, credit card) — this loan
                  will count as pure debt in Tracked Balance, same as before.
                </Text>
              )}
            </>
          )}
        </>
      )}

      {wizardStep === 2 && (
        <>
          <Text style={styles.fieldLabel}>Should Yume record the disbursement?</Text>
          <SegmentedControl
            options={[
              { label: 'Yes — track the cash move', value: 'new' },
              { label: 'No — already handled', value: 'existing' },
            ]}
            value={loanTiming}
            onChange={setLoanTiming}
          />

          <Text style={styles.fieldLabel}>
            {loanTiming === 'new' ? 'Disbursement date' : 'First EMI period started on'}
          </Text>
          <View style={styles.dateFieldsRow}>
            <View style={{ flex: 1 }}>
              <FormInput
                label="Day"
                value={startDay}
                onChangeText={setStartDay}
                keyboardType="numeric"
                placeholder="DD"
                style={styles.dateFieldInput}
              />
            </View>
            <View style={{ flex: 1 }}>
              <FormInput
                label="Month"
                value={startMonth}
                onChangeText={setStartMonth}
                keyboardType="numeric"
                placeholder="MM"
                style={styles.dateFieldInput}
              />
            </View>
            <View style={{ flex: 1.3 }}>
              <FormInput
                label="Year"
                value={startYear}
                onChangeText={setStartYear}
                keyboardType="numeric"
                placeholder="YYYY"
                style={styles.dateFieldInput}
              />
            </View>
          </View>
          <Text style={styles.hintText}>
            This is when the amortization actually starts — often the day the money was disbursed, not the
            date on a sanction letter or the day you happen to be entering this. Defaults to today; change it
            if the loan was disbursed earlier and you're just catching up.
          </Text>

          {loanTiming === 'new' ? (
            <>
              <Text style={styles.hintText}>
                Records the {direction === 'borrowed' ? 'cash you receive' : 'cash you hand over'} on the date
                above, so your account balance and net worth stay accurate.
              </Text>
              <Text style={styles.fieldLabel}>
                {direction === 'borrowed' ? 'Deposit into' : 'Pay from'} account
              </Text>
              <View style={styles.chipRow}>
                {accounts.map((acc) => (
                  <Chip
                    key={acc.id}
                    label={acc.name}
                    active={disbAccountId === acc.id}
                    onPress={() => setDisbAccountId(acc.id)}
                  />
                ))}
              </View>
              <FormInput
                label="Processing / documentation fees deducted (optional)"
                value={disbFee}
                onChangeText={setDisbFee}
                keyboardType="numeric"
                placeholder="0"
              />
              <Text style={styles.hintText}>
                Lenders routinely deduct processing, documentation, or franking charges at disbursement — a
                real cost that has nothing to do with the loan principal or its schedule. Recorded as its own
                expense on the same day, separate from the disbursement itself. Leave at 0 if none applied.
              </Text>

              <Text style={styles.fieldLabel}>First EMI due date</Text>
              <View style={styles.dateFieldsRow}>
                <View style={{ flex: 1 }}>
                  <FormInput
                    label="Day"
                    value={emiDay}
                    onChangeText={(v) => {
                      setEmiTouched(true);
                      setEmiDay(v);
                    }}
                    keyboardType="numeric"
                    placeholder="DD"
                    style={styles.dateFieldInput}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <FormInput
                    label="Month"
                    value={emiMonth}
                    onChangeText={(v) => {
                      setEmiTouched(true);
                      setEmiMonth(v);
                    }}
                    keyboardType="numeric"
                    placeholder="MM"
                    style={styles.dateFieldInput}
                  />
                </View>
                <View style={{ flex: 1.3 }}>
                  <FormInput
                    label="Year"
                    value={emiYear}
                    onChangeText={(v) => {
                      setEmiTouched(true);
                      setEmiYear(v);
                    }}
                    keyboardType="numeric"
                    placeholder="YYYY"
                    style={styles.dateFieldInput}
                  />
                </View>
              </View>
              <Text style={styles.hintText}>
                When the amortization schedule actually starts — often a month after disbursement, not the
                same day. Defaults to one month after the disbursement date above; check your loan agreement's
                own schedule if your lender uses a different gap.
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.hintText}>
                For a loan you're already partway through — no fake transaction is created for money that
                already moved before you started using Yume. 0 already paid is fine if you're only just past
                disbursement with nothing due yet.
              </Text>
              <FormInput
                label="Installments already paid"
                value={alreadyPaid}
                onChangeText={setAlreadyPaid}
                keyboardType="numeric"
                placeholder="e.g. 12"
              />
              <Text style={styles.fieldLabel}>Future EMIs come out of</Text>
              <View style={styles.chipRow}>
                {accounts.map((acc) => (
                  <Chip
                    key={acc.id}
                    label={acc.name}
                    active={repayAccountId === acc.id}
                    onPress={() => setRepayAccountId(acc.id)}
                  />
                ))}
              </View>
              <Text style={styles.hintText}>
                No disbursement is recorded for this loan, but Pay still needs to know which account each EMI
                should debit — change it any time from the loan's own screen.
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
