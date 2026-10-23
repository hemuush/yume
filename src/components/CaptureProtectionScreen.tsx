import type { ReactElement } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/Text';
import { PrimaryButton } from '@/components/PrimaryButton';
import { theme } from '@/constants/theme';
import type { ScreenCaptureStatus } from '@/lib/useScreenCaptureProtection';

/** Public recovery UI; no navigator, financial records or app dialogs mount behind it. */
export function CaptureProtectionScreen({
  status,
  onRetry,
}: {
  status: Exclude<ScreenCaptureStatus, 'ready'>;
  onRetry: () => void;
}): ReactElement {
  const insets = useSafeAreaInsets();
  const isFailed = status === 'failed';
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + theme.space.xxl, paddingBottom: insets.bottom + theme.space.xxl },
      ]}
    >
      <Text
        style={styles.title}
        accessibilityRole={isFailed ? 'alert' : 'header'}
        accessibilityLiveRegion="polite"
      >
        {isFailed ? 'Screen protection unavailable' : 'Protecting your screen'}
      </Text>
      <Text style={styles.body}>
        {isFailed
          ? 'Android couldn’t enable screenshot protection. Your financial screens will stay closed until protection is ready.'
          : 'Waiting for Android to enable screenshot protection before opening your finances.'}
      </Text>
      {isFailed ? (
        <PrimaryButton
          title="Try again"
          accessibilityLabel="Retry screen protection"
          onPress={onRetry}
          style={styles.retry}
        />
      ) : (
        <ActivityIndicator
          accessible
          size="large"
          color={theme.colors.ink}
          accessibilityRole="progressbar"
          accessibilityLabel="Checking screen protection"
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: theme.space.xxl },
  title: {
    fontFamily: theme.font.roundedBold,
    fontSize: theme.typeSize.title,
    color: theme.colors.ink,
    textAlign: 'center',
    marginBottom: theme.space.sm,
  },
  body: {
    fontFamily: theme.font.body,
    fontSize: theme.typeSize.row,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.space.xl,
  },
  retry: { alignSelf: 'stretch' },
});
