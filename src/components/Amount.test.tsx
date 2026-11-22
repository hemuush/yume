import { act, create } from 'react-test-renderer';
import { Text } from 'react-native';
import { Amount } from './Amount';

jest.mock('@/theme/PrivacyContext', () => ({ usePrivacy: () => ({ hideAmounts: false }) }));

const draw = (el: React.ReactElement) => {
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(el);
  });
  return tree;
};

describe('Amount exact', () => {
  it('draws the paise smaller than the rupees', () => {
    const tree = draw(<Amount minor={1250} currency="INR" exact style={{ fontSize: 20 }} />);
    const [outer, inner] = tree.root.findAllByType(Text);
    expect(outer.props.children[0]).toBe('₹12');
    expect(inner.props.children).toBe('.50');
    expect(inner.props.style.fontSize).toBe(16);
    act(() => tree.unmount());
  });

  it('leaves a whole amount, and an amount that is not exact, as one piece of text', () => {
    for (const el of [
      <Amount key="a" minor={1200} currency="INR" exact style={{ fontSize: 20 }} />,
      <Amount key="b" minor={1250} currency="INR" style={{ fontSize: 20 }} />,
    ]) {
      const tree = draw(el);
      expect(tree.root.findAllByType(Text)).toHaveLength(1);
      act(() => tree.unmount());
    }
  });

  it('keeps the text whole when no size is known', () => {
    const tree = draw(<Amount minor={1250} currency="INR" exact />);
    expect(tree.root.findAllByType(Text)).toHaveLength(1);
    act(() => tree.unmount());
  });
});
