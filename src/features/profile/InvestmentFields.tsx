import { Text } from '@/components/Text';
import { View } from 'react-native';
import { Chip } from '@/components/Chip';
import type { Account, InvestmentKind } from '@/types';
import { styles } from './profile.styles';
import { INVESTMENT_KIND_CHOICES } from './profile.constants';

/** The accounts an investment's money can come from: plain bank, cash or wallet accounts in its currency. */
export function fundingChoices(accounts: Account[], currency: string, selfId?: string): Account[] {
  return accounts.filter(
    (a) =>
      a.id !== selfId &&
      !a.archived &&
      !a.investment &&
      a.currency === currency &&
      ['bank', 'cash', 'wallet'].includes(a.type)
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
}: {
  kind: InvestmentKind | null;
  onKind: (kind: InvestmentKind | null) => void;
  fundingId: string | null;
  onFunding: (id: string | null) => void;
  choices: Account[];
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
      <Text style={styles.fieldLabel}>Money comes from</Text>
      {choices.length === 0 ? (
        <Text style={styles.hintText}>Add a bank, cash or wallet account in this currency to pick one.</Text>
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
