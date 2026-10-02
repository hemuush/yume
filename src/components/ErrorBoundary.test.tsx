/**
 * ErrorBoundary: a crash in one screen shows a recoverable message instead of
 * closing the app, and "Try again" re-renders the tree.
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());

import { ErrorBoundary } from './ErrorBoundary';

let shouldThrow = true;
function Bomb() {
  if (shouldThrow) throw new Error('boom');
  return <Text>fine</Text>;
}

const textOf = (tree: ReactTestRenderer) =>
  tree.root
    .findAllByType(Text)
    .map((n) => [n.props.children].flat().join(''))
    .join(' | ');

describe('ErrorBoundary', () => {
  beforeEach(() => {
    shouldThrow = true;
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('shows a calm message, reassurance and the technical detail', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(
        <ErrorBoundary>
          <Bomb />
        </ErrorBoundary>
      );
    });
    const text = textOf(tree);
    expect(text).toContain('Something went wrong');
    expect(text).toContain('Your entries are safe on this phone');
    expect(text).toContain('boom');
  });

  it('renders the children again after Try again', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(
        <ErrorBoundary>
          <Bomb />
        </ErrorBoundary>
      );
    });
    shouldThrow = false;
    await act(async () => {
      tree.root
        .find((n) => n.props.title === 'Try again' && typeof n.props.onPress === 'function')
        .props.onPress();
    });
    expect(textOf(tree)).toBe('fine');
  });
});
