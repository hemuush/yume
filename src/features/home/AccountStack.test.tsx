/**
 * Home's account stack: every account is a card, the front one is the last in
 * the order, and a swipe sends the back card to the front. The animation itself
 * is covered by accountStackMotion.test; this checks the behaviour around it —
 * what a drag does on release, who ends up in front, and what a screen reader
 * and a finger can reach.
 */
import { create, act, ReactTestRenderer, ReactTestInstance } from 'react-test-renderer';
import { PanResponder } from 'react-native';
import type { Account } from '@/types';

// A swipe's end is a completion callback on the UI thread. The stock mock never runs it, so this one
// queues it and the tests play it out by hand — after the assignment that started the animation, as the real thing does.
const mockPending: (() => void)[] = [];
let mockReduce = false;
jest.mock('react-native-reanimated', () => {
  const base = require('@/test-support/reanimatedMock').createReanimatedMock();
  return {
    ...base,
    withTiming: (to: unknown, _cfg: unknown, done?: (finished: boolean) => void) => {
      if (done) mockPending.push(() => done(true));
      return to;
    },
  };
});
jest.mock('@/lib/useReduceMotion', () => ({ useReduceMotion: () => mockReduce }));
jest.mock('@/lib/haptics', () => ({ haptics: { tap: jest.fn(), confirm: jest.fn(), warn: jest.fn() } }));

import { AccountStack } from './AccountStack';

const account = (id: string, type: Account['type'] = 'bank'): Account => ({
  id,
  name: `Account ${id}`,
  type,
  currency: 'INR',
  openingBalanceMinor: 0,
  currentBalanceMinor: 123400,
  creditLimitMinor: null,
  statementDay: null,
  dueDay: null,
  interestRateAnnualBp: null,
  archived: false,
  createdAt: '2026-01-01T00:00:00.000Z',
});
const accounts = (n: number) => Array.from({ length: n }, (_, i) => account(String(i)));

type Config = Parameters<typeof PanResponder.create>[0];
let config: Config;
beforeEach(() => {
  mockPending.length = 0;
  mockReduce = false;
  jest.spyOn(PanResponder, 'create').mockImplementation((c) => {
    config = c;
    return { panHandlers: {} } as ReturnType<typeof PanResponder.create>;
  });
});
afterEach(() => jest.restoreAllMocks());

const WIDTH = 320;

async function render(list: Account[], onOpen = jest.fn(), opening = false) {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<AccountStack accounts={list} onOpen={onOpen} opening={opening} />);
  });
  const container = tree.root.find((n) => typeof n.props.onLayout === 'function');
  await act(async () => {
    container.props.onLayout({ nativeEvent: { layout: { width: WIDTH, height: 200 } } });
  });
  return { tree, onOpen };
}

const card = (tree: ReactTestRenderer, id: string): ReactTestInstance =>
  tree.root.find((n) => n.props.testID === `account-card-${id}`);
const button = (tree: ReactTestRenderer, id: string): ReactTestInstance =>
  card(tree, id).find((n) => n.props.accessibilityRole === 'button');
/** The account the stack currently has in front: the only card offering "Show next account". */
const frontId = (tree: ReactTestRenderer) => {
  const fronts = tree.root.findAll(
    (n) =>
      typeof n.props.testID === 'string' &&
      n.props.testID.startsWith('account-card-') &&
      !!n.findAll((m) => Array.isArray(m.props.accessibilityActions)).length
  );
  return fronts[0]?.props.testID.replace('account-card-', '');
};
const flush = async () => {
  await act(async () => {
    while (mockPending.length) mockPending.shift()!();
  });
};
const swipe = async (dx: number, vx = 0) => {
  await act(async () => {
    config.onPanResponderGrant?.({} as never, {} as never);
    config.onPanResponderMove?.({} as never, { dx } as never);
    config.onPanResponderRelease?.({} as never, { dx, vx } as never);
  });
};

describe('AccountStack', () => {
  it('shows every account with its name, type and balance', async () => {
    const { tree } = await render([account('0'), account('1', 'savings'), account('2', 'cash')]);
    const text = JSON.stringify(tree.toJSON());
    expect(text).toContain('Account 0');
    expect(text).toContain('Account 1');
    expect(text).toContain('Account 2');
    expect(text).toContain('savings');
    expect(text).toContain('1,234');
  });

  it('puts the last account in front, and offers the swipe as an accessibility action on it alone', async () => {
    const { tree } = await render(accounts(3));
    expect(frontId(tree)).toBe('2');
    expect(button(tree, '2').props.accessibilityActions).toEqual([
      { name: 'next', label: 'Show next account' },
    ]);
    expect(button(tree, '0').props.accessibilityActions).toBeUndefined();
  });

  it('opens the account whose card was tapped', async () => {
    const { tree, onOpen } = await render(accounts(3));
    await act(async () => button(tree, '1').props.onPress());
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }));
  });

  it('does not make a single account swipeable', async () => {
    const { tree } = await render(accounts(1));
    expect(button(tree, '0').props.accessibilityActions).toBeUndefined();
    await swipe(200);
    expect(mockPending).toHaveLength(0);
  });

  describe('swiping', () => {
    it('only takes over a mostly-horizontal drag, leaving the page to scroll', async () => {
      await render(accounts(3));
      const capture = config.onMoveShouldSetPanResponderCapture!;
      expect(capture({} as never, { dx: 30, dy: 4 } as never)).toBe(true);
      expect(capture({} as never, { dx: -30, dy: 4 } as never)).toBe(true);
      expect(capture({} as never, { dx: 30, dy: 40 } as never)).toBe(false);
      expect(capture({} as never, { dx: 5, dy: 0 } as never)).toBe(false);
      expect(config.onPanResponderTerminationRequest?.({} as never, {} as never)).toBe(false);
    });

    it('sends the back card to the front when a drag is let go far enough', async () => {
      const { tree } = await render(accounts(3));
      await swipe(120);
      expect(mockPending).toHaveLength(1);
      await flush();
      expect(frontId(tree)).toBe('0');
    });

    it('goes round again on the next swipe, in either direction', async () => {
      const { tree } = await render(accounts(3));
      await swipe(120);
      await flush();
      await swipe(-120);
      await flush();
      expect(frontId(tree)).toBe('1');
      await swipe(120);
      await flush();
      expect(frontId(tree)).toBe('2');
    });

    it('commits a short drag that was a flick', async () => {
      const { tree } = await render(accounts(3));
      await swipe(40, 0.9);
      await flush();
      expect(frontId(tree)).toBe('0');
    });

    it('springs back when let go too soon, leaving the order alone', async () => {
      const { tree } = await render(accounts(3));
      await swipe(20, 0.05);
      await flush();
      expect(frontId(tree)).toBe('2');
    });

    it('ignores a second swipe while one is still landing', async () => {
      const { tree } = await render(accounts(3));
      await swipe(120);
      await swipe(120);
      expect(mockPending).toHaveLength(1);
      await flush();
      expect(frontId(tree)).toBe('0');
    });

    it('can be swiped with the accessibility action too', async () => {
      const { tree } = await render(accounts(3));
      await act(async () => {
        button(tree, '2').props.onAccessibilityAction({ nativeEvent: { actionName: 'next' } });
      });
      await flush();
      expect(frontId(tree)).toBe('0');
    });

    it('does nothing until the stack has been measured', async () => {
      let tree!: ReactTestRenderer;
      await act(async () => {
        tree = create(<AccountStack accounts={accounts(3)} onOpen={jest.fn()} />);
      });
      await swipe(120);
      expect(mockPending).toHaveLength(0);
      expect(frontId(tree)).toBe('2');
    });

    it('starts again from the resting order when an account is added', async () => {
      const { tree } = await render(accounts(3));
      await swipe(120);
      await flush();
      expect(frontId(tree)).toBe('0');
      await act(async () => {
        tree.update(<AccountStack accounts={accounts(4)} onOpen={jest.fn()} />);
      });
      expect(frontId(tree)).toBe('3');
    });
  });

  describe('with reduce motion on', () => {
    it('does not follow the finger, but still changes the front card on a firm swipe through a fade', async () => {
      mockReduce = true;
      const { tree } = await render(accounts(3));
      await swipe(120);
      expect(mockPending).toHaveLength(1);
      await flush();
      // The fade-out ends by reordering and starting a fade back in.
      expect(frontId(tree)).toBe('0');
      await flush();
      expect(mockPending).toHaveLength(0);
    });

    it('leaves a short drag alone', async () => {
      mockReduce = true;
      const { tree } = await render(accounts(3));
      await swipe(20);
      expect(mockPending).toHaveLength(0);
      expect(frontId(tree)).toBe('2');
    });
  });

  describe('with more than four accounts', () => {
    it('shows four cards and keeps the rest out of reach', async () => {
      const { tree } = await render(accounts(6));
      expect(frontId(tree)).toBe('3');
      for (const id of ['0', '1', '2', '3']) {
        expect(card(tree, id).props.pointerEvents).toBe('auto');
      }
      for (const id of ['4', '5']) {
        expect(card(tree, id).props.pointerEvents).toBe('none');
        expect(card(tree, id).props.accessibilityElementsHidden).toBe(true);
      }
    });

    it('brings the next account in when swiped, and lets the leaving one go', async () => {
      const { tree } = await render(accounts(6));
      await swipe(120);
      await flush();
      expect(frontId(tree)).toBe('4');
      expect(card(tree, '4').props.pointerEvents).toBe('auto');
      expect(card(tree, '0').props.pointerEvents).toBe('none');
    });

    it('shows a dot per account, and none when everything fits', async () => {
      const six = await render(accounts(6));
      const dots = six.tree.root.find((n) => n.props.testID === 'account-stack-dots');
      expect(dots.props.children).toHaveLength(6);
      const four = await render(accounts(4));
      expect(four.tree.root.findAll((n) => n.props.testID === 'account-stack-dots')).toHaveLength(0);
    });
  });
});
