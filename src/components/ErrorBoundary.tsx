import { Component, ErrorInfo, ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { PrimaryButton } from './PrimaryButton';
import { themedStyles } from '@/theme/themedStyles';
import { useSchemeVersion } from '@/theme/SchemeBoundary';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// Without this an uncaught error crashes the whole app (release Hermes builds show no red box, they just
// close); wrapping the app once turns a bug in one screen into a recoverable message.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  // Logged to logcat only: on-device by design, no crash-reporting service. Keeps the error and
  // component stack available after the fallback renders.
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return <ErrorFallback error={this.state.error} onRetry={this.reset} />;
    }
    return this.props.children;
  }
}

function ErrorFallback({ error, onRetry }: { error: Error; onRetry: () => void }) {
  useSchemeVersion();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.body}>
        Your entries are safe on this phone. Try again, and if it keeps happening, close Yume and reopen it.
      </Text>
      <Text style={styles.detail}>{error.message}</Text>
      <PrimaryButton title="Try again" onPress={onRetry} style={{ marginTop: 20, minWidth: 160 }} />
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.background,
      padding: 28,
    },
    title: {
      fontFamily: theme.font.roundedBold,
      fontSize: 17,
      color: theme.colors.textPrimary,
      marginBottom: 8,
    },
    body: {
      fontFamily: theme.font.body,
      fontSize: 13,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: 14,
    },
    detail: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textMuted, textAlign: 'center' },
  })
);
