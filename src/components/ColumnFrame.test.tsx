import { act, create } from 'react-test-renderer';
import { StyleSheet, Text, View } from 'react-native';
import { ColumnFrame, MAX_CONTENT_WIDTH, useContentWidth } from './ColumnFrame';

afterEach(() => jest.restoreAllMocks());

it('is a centred column no wider than 600 dp, filling the screen on a phone', () => {
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(
      <ColumnFrame>
        <Text>app</Text>
      </ColumnFrame>
    );
  });
  const [outside, column] = tree.root.findAllByType(View).map((v) => StyleSheet.flatten(v.props.style));
  expect(outside).toMatchObject({ flex: 1, alignItems: 'center' });
  expect(column).toMatchObject({ flex: 1, width: '100%', maxWidth: MAX_CONTENT_WIDTH });
  act(() => tree.unmount());
});

it.each([
  [390, 390],
  [600, 600],
  [840, 600],
])('gives a screen of %i dp a content width of %i', (screen, expected) => {
  jest
    .spyOn(require('react-native'), 'useWindowDimensions')
    .mockReturnValue({ width: screen, height: 900, fontScale: 1, scale: 1 });
  let seen = 0;
  const Probe = () => {
    seen = useContentWidth();
    return null;
  };
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(<Probe />);
  });
  act(() => tree.unmount());
  expect(seen).toBe(expected);
});
