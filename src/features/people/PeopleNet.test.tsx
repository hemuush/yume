/** The net card on Friends & family: the net figure, who is on each side, and the two totals. Made-up figures. */
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import { PeopleNet } from './PeopleNet';

const texts = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((t) => [t.props.children].flat().join(''));

function render(props: Partial<React.ComponentProps<typeof PeopleNet>> = {}) {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <PeopleNet
        netMinor={435_000}
        owedToYouMinor={935_000}
        youOweMinor={500_000}
        owedCount={3}
        oweCount={1}
        {...props}
      />
    );
  });
  return tree;
}

describe('PeopleNet', () => {
  it('leads with the net, signed, and counts the people on both sides', () => {
    const shown = texts(render());
    expect(shown).toContain('Net, in your favour');
    expect(shown).toContain('+₹4,350');
    expect(shown).toContain('4 people');
    expect(shown).toContain('3 owe you · you owe 1');
  });

  it('shows what is owed to you and what you owe as facts', () => {
    const shown = texts(render());
    expect(shown).toEqual(expect.arrayContaining(['Owed to you', '+₹9,350', 'You owe', '₹5,000']));
  });

  it('reads against you with a minus, and a single person in the singular', () => {
    const shown = texts(
      render({ netMinor: -500_000, owedToYouMinor: 0, youOweMinor: 500_000, owedCount: 0, oweCount: 1 })
    );
    expect(shown).toContain('Net, against you');
    expect(shown).toContain('−₹5,000');
    expect(shown).toContain('1 person');
  });
});
