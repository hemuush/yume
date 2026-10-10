import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import { UsualChips } from './AddSections';
import { formatMoney } from '@/lib/money';

jest.mock('@/theme/PrivacyContext', () => ({ usePrivacy: () => ({ hideAmounts: true }) }));
jest.mock('@/components/ModalSheet', () => ({ ModalSheet: () => null }));
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/theme/AccentContext', () => ({
  useAccent: () => ({ accent: '#8FCBFF', secondary: '#8FE8C8' }),
}));

it('masks sensitive usual amounts in visible text and TalkBack labels', () => {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <UsualChips
        usual={[
          {
            type: 'expense',
            accountId: 'bank',
            accountCurrency: 'INR',
            categoryId: 'private',
            categoryName: 'Investments',
            parentName: null,
            categoryIcon: 'cash',
            categoryColor: '#8FCBFF',
            amountMinor: 123400,
            note: '',
            timesLogged: 3,
            isSensitive: true,
          },
        ]}
        categoryId={null}
        accountId={null}
        amountMinor={0}
        onPick={jest.fn()}
      />
    );
  });
  const visible = tree.root
    .findAllByType(Text)
    .map((n) => [n.props.children].flat(Infinity).join(''))
    .join(' ');
  const labels = tree.root
    .findAll((n) => typeof n.props.accessibilityLabel === 'string')
    .map((n) => n.props.accessibilityLabel)
    .join(' ');
  expect(visible).toContain('••••');
  expect(labels).toContain('••••');
  expect(visible).not.toContain(formatMoney(123400));
  expect(labels).not.toContain(formatMoney(123400));
  act(() => tree.unmount());
});
