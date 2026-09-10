import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { setHasOnboarded, setUserName } from '@/db/settings';
import { FlynnIllustration } from '@/components/FlynnIllustration';
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';

interface Slide {
  title: string;
  subtitle: string;
  pose: 'default' | 'peek' | 'sleepy';
  isNameStep?: boolean;
}

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
  const ctaTextColor = accent === theme.colors.ink ? theme.colors.white : accent;
  const [index, setIndex] = useState(0);
  const [name, setName] = useState('');
  const isLast = index === SLIDES.length - 1;
  const slide = SLIDES[index];

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
    if (isLast) {
      void finish();
    } else {
      setIndex((i) => i + 1);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom }]}
      behavior="padding"
    >
      <Pressable style={[styles.skip, { top: insets.top + 12 }]} onPress={finish} hitSlop={10}>
        <Text style={styles.skipText}>Skip</Text>
      </Pressable>

      <View style={styles.illustWrap}>
        <FlynnIllustration size={140} pose={slide.pose} />
      </View>

      <Text style={styles.title}>{slide.title}</Text>
      <Text style={styles.subtitle}>{slide.subtitle}</Text>

      {slide.isNameStep && (
        <TextInput
          style={[styles.nameInput, { borderColor: theme.colors.ink }]}
          placeholder="Your name"
          placeholderTextColor={theme.colors.textMuted}
          value={name}
          onChangeText={setName}
          maxLength={40}
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={next}
        />
      )}

      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[styles.dot, i === index && { width: 20, backgroundColor: accent }]} />
        ))}
      </View>

      <Pressable style={styles.cta} onPress={next}>
        <Text style={[styles.ctaText, { color: ctaTextColor }]}>{isLast ? 'Get Started' : 'Next'}</Text>
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
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
    borderWidth: theme.border.thick,
    borderColor: theme.colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: theme.font.display,
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
    backgroundColor: theme.colors.surface,
    borderWidth: theme.border.thick,
    borderRadius: theme.radius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: theme.font.bodyMedium,
    fontSize: 16,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 28 },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: theme.colors.ink,
  },
  cta: {
    marginTop: 'auto',
    marginBottom: 24,
    backgroundColor: theme.colors.ink,
    borderRadius: theme.radius.lg,
    paddingVertical: 15,
    alignItems: 'center',
  },
  ctaText: { fontFamily: theme.font.bodyBold, fontSize: 15 },
});
