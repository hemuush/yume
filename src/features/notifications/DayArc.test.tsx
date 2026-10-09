/**
 * Notifications' day arc: a sun on the morning time and a moon on the evening time, each labelled; a slot
 * that's off leaves the arc, and the whole arc reads as one line for a screen reader.
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import { DayArc } from './DayArc';

const texts = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((t) => [].concat(t.props.children).join(''));

async function render(morningOn: boolean, eveningOn: boolean) {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <DayArc
        morning={{ on: morningOn, minutes: 9 * 60 }}
        evening={{ on: eveningOn, minutes: 21 * 60 + 30 }}
      />
    );
  });
  // The plot draws once it knows its width.
  const plot = tree.root.find((n) => typeof n.props.onLayout === 'function');
  await act(async () => plot.props.onLayout({ nativeEvent: { layout: { width: 320, height: 112 } } }));
  return { tree, plot };
}

describe('DayArc', () => {
  it('marks both times when both are on', async () => {
    const { tree, plot } = await render(true, true);
    expect(texts(tree)).toEqual(expect.arrayContaining(['9:00 AM', '9:30 PM']));
    expect(plot.props.accessibilityLabel).toBe('Morning at 9:00 AM · Evening at 9:30 PM');
  });

  it('leaves a switched-off time off the arc', async () => {
    const { tree, plot } = await render(true, false);
    expect(texts(tree)).toContain('9:00 AM');
    expect(texts(tree)).not.toContain('9:30 PM');
    expect(plot.props.accessibilityLabel).toBe('Morning at 9:00 AM');
  });

  it('says no times are on when both are off', async () => {
    const { plot } = await render(false, false);
    expect(plot.props.accessibilityLabel).toBe('No times on');
  });
});
