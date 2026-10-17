/** The add button of Plan's budgets and goals grids: shown while there is room, never past two rows. */
import { create, act } from 'react-test-renderer';

jest.mock('@expo/vector-icons/Feather', () => () => null);

import { AddSlot, GRID_SHOWN } from './PlanGrid';

const add = (count: number) => {
  const onPress = jest.fn();
  let r!: ReturnType<typeof create>;
  act(() => {
    r = create(<AddSlot count={count} label="Add" accessibilityLabel="Add a budget" onPress={onPress} />);
  });
  // A full grid draws nothing: the renderer then has no root to search.
  const nodes = r.toJSON()
    ? r.root.findAll((n) => n.props.accessibilityLabel === 'Add a budget' && n.props.onPress)
    : [];
  return { nodes, onPress };
};

describe('AddSlot', () => {
  it.each([0, 1, 2, 3, 4, 5])('is offered after %i tiles and opens add', (count) => {
    const { nodes, onPress } = add(count);
    expect(nodes.length).toBeGreaterThan(0);
    act(() => nodes[0].props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is left out once two rows are full', () => {
    expect(add(GRID_SHOWN).nodes).toHaveLength(0);
  });
});
