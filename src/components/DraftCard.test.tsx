import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import { DraftCard } from './DraftCard';

// The icon is drawn as a glyph in a Text of its own; the words start after it.
const texts = (tree: ReactTestRenderer) =>
  tree.root
    .findAllByType(Text)
    .slice(1)
    .map((t) => [t.props.children].flat().join(''));

function render(props: Partial<React.ComponentProps<typeof DraftCard>>) {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(<DraftCard hue="#8FE8C8" icon="bank" title="Cash" kicker="Cash" {...props} />);
  });
  return tree;
}

describe('DraftCard', () => {
  it('shows the figure and what it is per', () => {
    const tree = render({ figure: '₹347', per: 'balance', meta: 'Opened with ₹100' });
    expect(texts(tree)).toEqual(['Cash', 'Cash', '₹347', 'balance', 'Opened with ₹100']);
    act(() => tree.unmount());
  });

  it('shows a dash until the figure can be worked out', () => {
    const tree = render({ per: 'a month' });
    expect(texts(tree)).toContain('–');
    act(() => tree.unmount());
  });

  it('has no figure column at all without `per`, and no meta line without meta', () => {
    const tree = render({});
    expect(texts(tree)).toEqual(['Cash', 'Cash']);
    act(() => tree.unmount());
  });
});
