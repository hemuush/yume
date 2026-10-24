/** The pieces around the Investments page: Plan's card, the chart, and the Update values list. */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
let mockHide = false;
jest.mock('@/theme/PrivacyContext', () => ({ usePrivacy: () => ({ hideAmounts: mockHide }) }));
jest.mock('@/theme/AccentContext', () => ({
  useAccent: () => ({ accent: '#8FCBFF', secondary: '#8FE8C8', onAccent: '#12130F' }),
}));
jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: ({ children, footer, visible }: { children: unknown; footer?: unknown; visible: boolean }) =>
    visible ? require('react').createElement(require('react').Fragment, null, children, footer) : null,
  SheetLink: () => null,
  SheetFooter: () => null,
}));
jest.mock('@/components/SheetFlow', () => ({
  SheetFlow: ({ children }: { children: unknown }) =>
    require('react').createElement(require('react').Fragment, null, children),
}));
jest.mock('./UpdateValueSheet', () => ({
  UpdateValueSheet: (p: { account: { id: string }; onSaved: () => void; onClose: () => void }) =>
    require('react').createElement(require('react-native').Text, {
      testID: `editing-${p.account.id}`,
      onPress: p.onSaved,
    }),
}));

import { InvestmentsCard } from './InvestmentsCard';
import { PortfolioChart } from './PortfolioChart';
import { UpdateValuesSheet } from './UpdateValuesSheet';
import { InvestmentPanel } from './InvestmentPanel';
import { buildPortfolio } from '@/lib/portfolio';
import type { Account } from '@/types';

const TODAY = '2026-10-24';
const inv = (
  id: string,
  name: string,
  value: number,
  valuedAt: string | null,
  gain: number | null
): Account =>
  ({
    id,
    name,
    type: 'savings',
    currency: 'INR',
    archived: false,
    openingBalanceMinor: value,
    currentBalanceMinor: value,
    createdAt: '2025-01-01 10:00:00',
    investment: {
      investedMinor: value,
      takenOutMinor: 0,
      gainMinor: gain,
      valuedAt,
      lastValueMinor: null,
      kind: null,
      fundingAccountId: null,
    },
  }) as Account;
const fund = inv('fund', 'Nifty 50', 438_000_00, '2026-10-12', 38_000_00);
const gold = inv('gold', 'Gold', 100_000_00, '2026-08-01', 0);
const never = inv('new', 'Fresh fund', 5_000_00, null, null);

const render = (el: React.ReactElement) => {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(el);
  });
  return tree;
};
const texts = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((t) => [].concat(t.props.children).join(''));

beforeEach(() => {
  mockHide = false;
});

describe('InvestmentsCard', () => {
  it('invites a first investment when there are none', () => {
    const open = jest.fn();
    const tree = render(
      <InvestmentsCard portfolio={buildPortfolio([], 'INR', TODAY)} monthlySipMinor={0} onOpen={open} />
    );
    expect(texts(tree)).toContain('Track an investment');
    act(() => tree.root.find((n) => n.props.accessibilityRole === 'button').props.onPress());
    expect(open).toHaveBeenCalled();
  });

  it('shows worth, gain, the monthly SIPs and how many values are due', () => {
    const tree = render(
      <InvestmentsCard
        portfolio={buildPortfolio([fund, gold], 'INR', TODAY)}
        monthlySipMinor={10_000_00}
        onOpen={jest.fn()}
      />
    );
    const shown = texts(tree).join(' ');
    expect(shown).toContain('538,000');
    expect(shown).toContain('SIPs');
    expect(shown).toContain('1 value is due an update');
  });

  it('masks the figures while savings are hidden', () => {
    mockHide = true;
    const shown = texts(
      render(
        <InvestmentsCard
          portfolio={buildPortfolio([fund], 'INR', TODAY)}
          monthlySipMinor={5_000_00}
          onOpen={jest.fn()}
        />
      )
    ).join(' ');
    expect(shown).not.toContain('438,000');
    expect(shown).toContain('••••');
  });
});

describe('PortfolioChart', () => {
  const points = [
    { date: '2026-04-01', valueMinor: 100_000_00, putInMinor: 90_000_00 },
    { date: '2026-10-01', valueMinor: 120_000_00, putInMinor: 100_000_00 },
  ];
  it('says what it needs when there is only one point', () => {
    const tree = render(
      <PortfolioChart points={points.slice(0, 1)} currency="INR" masked={false} color="#000" />
    );
    expect(texts(tree).join(' ')).toContain('two different days');
  });
  it('describes itself in words, and hides the figures when masked', () => {
    const open = render(<PortfolioChart points={points} currency="INR" masked={false} color="#000" />);
    const label = open.root.find((n) => n.props.accessibilityRole === 'image').props.accessibilityLabel;
    expect(label).toContain('120,000');
    const hidden = render(<PortfolioChart points={points} currency="INR" masked color="#000" />);
    expect(
      hidden.root.find((n) => n.props.accessibilityRole === 'image').props.accessibilityLabel
    ).not.toContain('120,000');
  });
});

describe('UpdateValuesSheet', () => {
  const holdings = () => buildPortfolio([fund, gold, never], 'INR', TODAY).holdings;
  const rows = (tree: ReactTestRenderer) =>
    tree.root.findAll((n) => n.props.icon && n.props.label && n.props.onPress);

  it('lists the oldest value first, with never-updated ones before them', () => {
    const tree = render(
      <UpdateValuesSheet visible holdings={holdings()} onClose={jest.fn()} onChanged={jest.fn()} />
    );
    expect(rows(tree).map((r) => r.props.label)).toEqual(['Fresh fund', 'Gold', 'Nifty 50']);
    expect(texts(tree).some((t) => t.includes('No update yet'))).toBe(true);
  });

  it('ticks a holding once its value is saved and tells the page to reload', () => {
    const changed = jest.fn();
    const tree = render(
      <UpdateValuesSheet visible holdings={holdings()} onClose={jest.fn()} onChanged={changed} />
    );
    act(() =>
      rows(tree)
        .find((r) => r.props.label === 'Gold')!
        .props.onPress()
    );
    act(() => tree.root.findByProps({ testID: 'editing-gold' }).props.onPress());
    expect(changed).toHaveBeenCalledTimes(1);
    const gold = rows(tree).find((r) => r.props.label === 'Gold')!;
    expect(gold.props.icon).toBe('check');
    expect(gold.props.sub).toContain('Updated today');
  });
});

describe('InvestmentPanel actions', () => {
  const panel = (extra: object = {}) =>
    render(
      <InvestmentPanel
        account={fund}
        valuations={[]}
        nextSip={null}
        masked={false}
        onUpdate={jest.fn()}
        onEdit={jest.fn()}
        {...extra}
      />
    );
  const buttons = (tree: ReactTestRenderer) =>
    tree.root.findAll((n) => typeof n.props.title === 'string' && typeof n.props.onPress === 'function');

  it('adds Add a SIP and Withdraw only when they are given', () => {
    expect(buttons(panel()).map((b) => b.props.title)).toEqual(['Update value']);
    const onWithdraw = jest.fn();
    const onAddSip = jest.fn();
    const tree = panel({ onWithdraw, onAddSip });
    expect(buttons(tree).map((b) => b.props.title)).toEqual(['Update value', 'Add a SIP', 'Withdraw']);
    act(() =>
      buttons(tree)
        .find((b) => b.props.title === 'Withdraw')!
        .props.onPress()
    );
    act(() =>
      buttons(tree)
        .find((b) => b.props.title === 'Add a SIP')!
        .props.onPress()
    );
    expect(onWithdraw).toHaveBeenCalled();
    expect(onAddSip).toHaveBeenCalled();
  });
});
