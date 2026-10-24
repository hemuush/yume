import { Text } from '@/components/Text';
import { View } from 'react-native';
import { Chip } from '@/components/Chip';
import { AmountField } from '@/components/AmountField';
import { DateField } from '@/components/DateField';
import { addDaysToIsoDate, toLocalIsoDate } from '@/lib/date';
import { earnsKnownRate } from '@/lib/investment';
import type { Account, InvestmentKind } from '@/types';
import { styles } from './profile.styles';
import { INVESTMENT_KIND_CHOICES } from './profile.constants';

/** The accounts an investment's money can come from: plain bank or wallet accounts in its currency. */
export function fundingChoices(accounts: Account[], currency: string, selfId?: string): Account[] {
  return accounts.filter(
    (a) =>
      a.id !== selfId &&
      !a.archived &&
      !a.investment &&
      a.currency === currency &&
      ['bank', 'wallet'].includes(a.type)
  );
}

/**
 * What sort of holding an investment is, and which account its money normally comes from. Both are optional:
 * tap the chosen one again to clear it. The funding account is what Invest and SIPs start from.
 */
export function InvestmentFields({
  kind,
  onKind,
  fundingId,
  onFunding,
  choices,
  rate,
  onRate,
  maturity,
  onMaturity,
}: {
  kind: InvestmentKind | null;
  onKind: (kind: InvestmentKind | null) => void;
  fundingId: string | null;
  onFunding: (id: string | null) => void;
  choices: Account[];
  /** A deposit's or provident fund's yearly rate, in percent as typed. */
  rate: string;
  onRate: (v: string) => void;
  /** A fixed deposit's maturity date (YYYY-MM-DD), or '' for none. */
  maturity: string;
  onMaturity: (v: string) => void;
}) {
  return (
    <View>
      <Text style={styles.fieldLabel}>Kind</Text>
      <View style={styles.chipRow}>
        {INVESTMENT_KIND_CHOICES.map((k) => (
          <Chip
            key={k.value}
            label={k.label}
            active={kind === k.value}
            onPress={() => onKind(kind === k.value ? null : k.value)}
          />
        ))}
      </View>
      {earnsKnownRate(kind) && (
        <>
          <AmountField
            label="Interest rate (% a year)"
            value={rate}
            onChangeText={onRate}
            placeholder="e.g. 7.1"
            maxLength={5}
          />
          <Text style={styles.hintText}>
            With a rate, Yume estimates today's value between your updates. Your bank's figure is always the
            one to enter.
          </Text>
          {kind === 'fixed_deposit' &&
            (maturity ? (
              <>
                <DateField label="Matures on" value={maturity} onChange={onMaturity} />
                <View style={styles.chipRow}>
                  <Chip label="No maturity date" active={false} onPress={() => onMaturity('')} />
                </View>
              </>
            ) : (
              <>
                <Text style={styles.fieldLabel}>Maturity</Text>
                <View style={styles.chipRow}>
                  <Chip
                    label="Set a maturity date"
                    active={false}
                    onPress={() => onMaturity(addDaysToIsoDate(toLocalIsoDate(new Date()), 365))}
                  />
                </View>
              </>
            ))}
        </>
      )}
      <Text style={styles.fieldLabel}>Usually funded from (optional)</Text>
      {choices.length === 0 ? (
        <Text style={styles.hintText}>Add a bank or wallet account in this currency to pick one.</Text>
      ) : (
        <>
          <View style={styles.chipRow}>
            {choices.map((a) => (
              <Chip
                key={a.id}
                label={a.name}
                active={fundingId === a.id}
                onPress={() => onFunding(fundingId === a.id ? null : a.id)}
              />
            ))}
          </View>
          <Text style={styles.hintText}>
            Invest and SIPs start from this account. You can change it any time.
          </Text>
        </>
      )}
    </View>
  );
}
