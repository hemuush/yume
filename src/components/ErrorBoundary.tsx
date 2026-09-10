import { Component, ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { PrimaryButton } from './PrimaryButton';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// Without this, an uncaught error anywhere in the tree crashes the whole app
// with no recovery — release Hermes builds don't show a red box, they just
// close. Wrapping the app once means a bug in one screen shows a recoverable
// message instead of forcing an unexplained crash for whoever it's shared with.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.detail}>{this.state.error.message}</Text>
          <PrimaryButton title="Try again" onPress={this.reset} style={{ marginTop: 20, minWidth: 160 }} />
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    padding: 28,
  },
  title: {
    fontFamily: theme.font.roundedBold,
    fontSize: 19,
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  detail: { fontFamily: theme.font.body, fontSize: 13, color: theme.colors.textMuted, textAlign: 'center' },
});
