import { Text } from 'react-native';
import { act, create } from 'react-test-renderer';
import { memoByModelKeys } from './memoByModelKeys';

let drawn = 0;
function Section({ model }: { model: { amount: number; title: string } }) {
  drawn++;
  return <Text>{`${model.title} ${model.amount}`}</Text>;
}
const KEYS = ['title'] as const;
const Memoized = memoByModelKeys(Section as never, KEYS as never) as unknown as (props: {
  model: { amount: number; title: string };
}) => React.ReactElement;

beforeEach(() => {
  drawn = 0;
});

describe('memoByModelKeys', () => {
  it('draws the section again only when a field it declared changes', () => {
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<Memoized model={{ amount: 1, title: 'Add' }} />);
    });
    expect(drawn).toBe(1);
    // A field it did not declare changes: the section is left as it is.
    act(() => tree.update(<Memoized model={{ amount: 2, title: 'Add' }} />));
    expect(drawn).toBe(1);
    // The same fields in a new model object: nothing to draw.
    act(() => tree.update(<Memoized model={{ amount: 2, title: 'Add' }} />));
    expect(drawn).toBe(1);
    act(() => tree.update(<Memoized model={{ amount: 2, title: 'Edit' }} />));
    expect(drawn).toBe(2);
    expect(tree.root.findByType(Text).props.children).toBe('Edit 2');
  });
});
