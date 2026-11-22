/** One component draws every category icon: a built-in name as an icon, the person's own emoji as text. */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet, Text } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { CategoryGlyph } from './CategoryGlyph';
import { CategoryIcon } from './CategoryIcon';
import { categoryTone } from '@/lib/categoryTone';

const COFFEE = '☕';
const FAMILY = '\u{1F468}‍\u{1F469}‍\u{1F467}‍\u{1F466}';

const trees: ReactTestRenderer[] = [];
function render(node: React.ReactElement) {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(node);
  });
  trees.push(tree);
  return tree;
}
afterEach(() => act(() => trees.splice(0).forEach((t) => t.unmount())));

describe('CategoryGlyph', () => {
  it('draws a built-in name as an icon in the given colour and size', () => {
    const tree = render(<CategoryGlyph name="silverware-fork-knife" size={20} color="#123456" />);
    const icon = tree.root.findByType(MaterialCommunityIcons);
    expect(icon.props).toEqual(
      expect.objectContaining({ name: 'silverware-fork-knife', size: 20, color: '#123456' })
    );
  });

  it('draws an emoji as text, a little larger than an icon of the same size, with no icon', () => {
    const tree = render(<CategoryGlyph name={COFFEE} size={20} color="#123456" />);
    expect(tree.root.findAllByType(MaterialCommunityIcons)).toHaveLength(0);
    const text = tree.root.findByType(Text);
    expect(text.props.children).toBe(COFFEE);
    const style = StyleSheet.flatten(text.props.style);
    expect(style.fontSize).toBe(22);
    expect(style.textAlign).toBe('center');
    // The colour of an emoji is the phone's own: the icon colour is not applied to it.
    expect(style.color).toBeUndefined();
  });

  it('keeps an emoji the size the design gave it whatever the phone’s font size, and out of screen readers', () => {
    const tree = render(<CategoryGlyph name={COFFEE} size={20} color="#000" />);
    const text = tree.root.findByType(Text);
    expect(text.props.allowFontScaling).toBe(false);
    expect(text.props.accessible).toBe(false);
    expect(text.props.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('draws a joined emoji (a family) as one text', () => {
    const tree = render(<CategoryGlyph name={FAMILY} size={16} color="#000" />);
    expect(tree.root.findByType(Text).props.children).toBe(FAMILY);
  });

  it('draws a built-in name that merely looks unusual as an icon, not as the person’s emoji', () => {
    const tree = render(<CategoryGlyph name="numeric-1-box" size={16} color="#000" />);
    expect(tree.root.findAllByType(MaterialCommunityIcons)).toHaveLength(1);
  });
});

describe('CategoryIcon', () => {
  it('puts an emoji in the same tinted tile as a built-in icon', () => {
    const builtIn = render(<CategoryIcon name="home" color="#8FCBFF" square={40} size={18} />);
    const own = render(<CategoryIcon name={COFFEE} color="#8FCBFF" square={40} size={18} />);
    const tile = (t: ReactTestRenderer) =>
      StyleSheet.flatten(t.root.findAll((n) => typeof n.type === 'string')[0].props.style);
    expect(tile(own)).toEqual(tile(builtIn));
    expect(own.root.findByType(Text).props.children).toBe(COFFEE);
  });
});

describe('CategoryIcon tile', () => {
  const tileStyle = (t: ReactTestRenderer) =>
    StyleSheet.flatten(t.root.findAll((n) => typeof n.type === 'string')[0].props.style);

  it('is a wash of the category colour with a deep glyph of the same hue', () => {
    const tree = render(<CategoryIcon name="home" color="#FF9E7D" square={40} size={18} />);
    const tone = categoryTone('#FF9E7D')!;
    expect(tileStyle(tree).backgroundColor).toBe(tone.fill);
    expect(tree.root.findByType(MaterialCommunityIcons).props.color).toBe(tone.glyph);
  });

  it('gives two categories two different tiles', () => {
    const a = render(<CategoryIcon name="home" color="#FF9E7D" />);
    const b = render(<CategoryIcon name="home" color="#8FCBFF" />);
    expect(tileStyle(a).backgroundColor).not.toBe(tileStyle(b).backgroundColor);
  });

  it('stays the quiet neutral tile when the colour is not a hex value', () => {
    const tree = render(<CategoryIcon name="home" color="not-a-colour" />);
    expect(tileStyle(tree).backgroundColor).not.toBe(categoryTone('#FF9E7D')!.fill);
    expect(tree.root.findByType(MaterialCommunityIcons).props.color).not.toBe(categoryTone('#FF9E7D')!.glyph);
  });
});
