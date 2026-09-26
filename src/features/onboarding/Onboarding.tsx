import { useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { setHasOnboarded, setUserName } from '@/db/settings';
import { createAccount } from '@/db/ledger';
import { toMinor } from '@/lib/money';
import { AccountType } from '@/types';
import { CategoryIcon } from '@/components/CategoryIcon';
import { SuuIllustration } from '@/components/SuuIllustration';
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';

interface Slide {
  title: string;
  subtitle: string;
  pose: 'default' | 'peek' | 'sleepy';
  isNameStep?: boolean;
  isAccountsStep?: boolean;
}

/**
 * The starter accounts the last step offers. Without at least one account a
 * new user's first tap on + can't save anything (the Add screen has nothing
 * to pick), and the only way to make one used to be three taps deep behind
 * the Profile avatar. Names are ordinary and editable later in Profile.
 */
interface StarterAccount {
  key: string;
  type: AccountType;
  name: string;
  icon: string;
  color: string;
}
const STARTER_ACCOUNTS: StarterAccount[] = [
  { key: 'bank', type: 'bank', name: 'Bank account', icon: 'bank', color: theme.colors.primary },
  { key: 'cash', type: 'cash', name: 'Cash', icon: 'cash', color: theme.colors.gold },
  { key: 'upi', type: 'wallet', name: 'UPI wallet', icon: 'wallet', color: theme.colors.accent },
];

const SLIDES: Slide[] = [
  {
    title: 'Better money, bigger dreams',
    subtitle:
      'Yume keeps every rupee in one calm place — daily spending, savings, and the friends you owe. Fully offline.',
    pose: 'default',
  },
  {
    title: 'Loans, without the headache',
    subtitle:
      'EMI, interest, prepayments — Yume does the maths so you always know how close you are to done.',
    pose: 'peek',
  },
  {
    title: 'Yours, and only yours',
    subtitle:
      'Nothing leaves your phone. Back up to a folder you choose, or export a file whenever you want — never required.',
    pose: 'sleepy',
  },
  {
    title: 'What should we call you?',
    subtitle: 'Optional — you can change or add this anytime in Settings.',
    pose: 'default',
    isNameStep: true,
  },
  {
    title: 'Where does your money live?',
    subtitle: 'Pick what you use. You can rename these or add more anytime in Profile.',
    pose: 'peek',
    isAccountsStep: true,
  },
];

/**
 * Rendered directly by the root layout rather than pushed as a route:
 * expo-router picks the first screen from the launch URL ("/"), so a
 * `initialRouteName="onboarding"` on the Stack was silently ignored and
 * first-run users went straight to an empty dashboard.
 */
export function Onboarding({ onDone }: { onDone: () => void }) {
  const { accent } = useAccent();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const [name, setName] = useState('');
  const [nameFocused, setNameFocused] = useState(false);
  const [picked, setPicked] = useState<Record<string, boolean>>({ bank: true, cash: true, upi: false });
  const [openings, setOpenings] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  // Starter accounts already created — a retry after a partial failure must
  // never create the same account twice.
  const createdKeys = useRef(new Set<string>());
  const isLast = index === SLIDES.length - 1;
  const slide = SLIDES[index];

  /** Creates the picked starter accounts. False if any failed (the user stays on this step to retry or skip). */
  const createPickedAccounts = async (): Promise<boolean> => {
    for (const starter of STARTER_ACCOUNTS) {
      if (!picked[starter.key] || createdKeys.current.has(starter.key)) continue;
      const typed = parseFloat(openings[starter.key] || '0');
      try {
        await createAccount({
          name: starter.name,
          type: starter.type,
          openingBalanceMinor: Number.isFinite(typed) ? toMinor(typed) : 0,
        });
        createdKeys.current.add(starter.key);
      } catch {
        return false;
      }
    }
    return true;
  };

  const getStarted = async () => {
    setAccountsError(null);
    setCreating(true);
    const ok = await createPickedAccounts();
    setCreating(false);
    if (!ok) {
      setAccountsError("Couldn't add every account. Try again, or skip and add them later in Profile.");
      return;
    }
    await finish();
  };

  const finish = async () => {
    try {
      if (name.trim()) await setUserName(name);
      await setHasOnboarded(true);
    } catch {
      // A failed write here must never trap a first-run user on this screen
      // forever with no way out — worst case if `setHasOnboarded` itself
      // failed is onboarding reappears next launch, which is recoverable;
      // getting stuck here with no error UI and no retry is not.
    } finally {
      onDone();
    }
  };

  const next = () => {
    if (creating) return;
    if (isLast) {
      void getStarted();
    } else {
      setIndex((i) => i + 1);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom }]}
      behavior="padding"
    >
      <Pressable
        style={[styles.skip, { top: insets.top + 12 }]}
        onPress={finish}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Skip"
      >
        <Text style={styles.skipText}>Skip</Text>
      </Pressable>

      <View style={[styles.illustWrap, slide.isAccountsStep && styles.illustWrapSmall]}>
        <SuuIllustration size={slide.isAccountsStep ? 84 : 140} pose={slide.pose} />
      </View>

      <Text style={[styles.title, slide.isAccountsStep && styles.titleCompact]}>{slide.title}</Text>
      <Text style={styles.subtitle}>{slide.subtitle}</Text>

      {slide.isNameStep && (
        <TextInput
          style={[styles.nameInput, nameFocused && styles.nameInputFocused]}
          placeholder="Your name"
          placeholderTextColor={theme.colors.textMuted}
          value={name}
          onChangeText={setName}
          onFocus={() => setNameFocused(true)}
          onBlur={() => setNameFocused(false)}
          maxLength={40}
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={next}
        />
      )}

      {slide.isAccountsStep && (
        <ScrollView
          style={styles.accountsScroll}
          contentContainerStyle={styles.accountsList}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {STARTER_ACCOUNTS.map((starter) => {
            const on = !!picked[starter.key];
            return (
              <View key={starter.key} style={[styles.accountCard, on && styles.accountCardOn]}>
                <Pressable
                  onPress={() => setPicked((prev) => ({ ...prev, [starter.key]: !prev[starter.key] }))}
                  style={styles.accountHead}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={starter.name}
                >
                  <CategoryIcon name={starter.icon} color={starter.color} size={17} square={36} />
                  <Text style={styles.accountName}>{starter.name}</Text>
                  <View style={[styles.check, on && styles.checkOn]}>
                    {on && <Feather name="check" size={13} color={theme.colors.surface} />}
                  </View>
                </Pressable>
                {on && (
                  <TextInput
                    style={styles.openingInput}
                    placeholder="Current balance (optional)"
                    placeholderTextColor={theme.colors.textMuted}
                    value={openings[starter.key] ?? ''}
                    onChangeText={(v) => setOpenings((prev) => ({ ...prev, [starter.key]: v }))}
                    keyboardType="numeric"
                    maxLength={12}
                    accessibilityLabel={`${starter.name} current balance`}
                  />
                )}
              </View>
            );
          })}
          {accountsError && <Text style={styles.accountsError}>{accountsError}</Text>}
        </ScrollView>
      )}

      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === index && { width: 20, backgroundColor: accent, opacity: 1 }]}
          />
        ))}
      </View>

      <Pressable
        style={[styles.cta, creating && styles.ctaBusy]}
        onPress={next}
        disabled={creating}
        accessibilityRole="button"
        testID="onboarding-cta"
      >
        <Text style={[styles.ctaText, { color: accent }]}>
          {creating ? 'Setting up…' : isLast ? 'Get Started' : 'Next'}
        </Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, paddingHorizontal: 28 },
  skip: { position: 'absolute', right: 24, zIndex: 2 },
  skipText: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.textMuted },
  illustWrap: {
    alignSelf: 'center',
    marginTop: 70,
    width: 200,
    height: 200,
    borderRadius: theme.radius.xl2,
    backgroundColor: theme.colors.primaryTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustWrapSmall: { marginTop: 36, width: 120, height: 120 },
  titleCompact: { marginTop: 20 },
  accountsScroll: { flexGrow: 0, flexShrink: 1, marginTop: 18, alignSelf: 'stretch' },
  accountsList: { gap: 10, paddingBottom: 4 },
  accountCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl2,
    borderWidth: 1.5,
    borderColor: theme.colors.borderSoft,
    padding: 10,
  },
  accountCardOn: { borderColor: theme.colors.secondary },
  accountHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  accountName: { flex: 1, fontFamily: theme.font.bodyBold, fontSize: 14, color: theme.colors.textPrimary },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: theme.colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: theme.colors.ink, borderColor: theme.colors.ink },
  openingInput: {
    marginTop: 10,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: theme.font.monoBold,
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  accountsError: {
    fontFamily: theme.font.bodyBold,
    fontSize: 12,
    color: theme.colors.expense,
    textAlign: 'center',
    marginTop: 4,
  },
  title: {
    fontFamily: theme.font.roundedBold,
    fontSize: 22,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginTop: 32,
  },
  subtitle: {
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 19,
  },
  nameInput: {
    marginTop: 20,
    alignSelf: 'stretch',
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: 'transparent',
    borderRadius: theme.radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: theme.font.bodyMedium,
    fontSize: 16,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  nameInputFocused: { backgroundColor: theme.colors.surface, borderColor: theme.colors.secondary },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 28 },
  // A plain muted fill rather than an outlined dot — a hairline border was
  // barely visible against the page's own cream anyway, and a solid fill
  // reads clearly with no border needed.
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.colors.textMuted,
    opacity: 0.35,
  },
  cta: {
    marginTop: 'auto',
    marginBottom: 24,
    backgroundColor: theme.colors.ink,
    borderRadius: theme.radius.lg,
    paddingVertical: 15,
    alignItems: 'center',
  },
  ctaBusy: { opacity: 0.6 },
  ctaText: { fontFamily: theme.font.bodyBold, fontSize: 15 },
});
