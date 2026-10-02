import {
  STACK,
  cardPose,
  dragProgress,
  shouldCommit,
  slotOf,
  stackHeight,
  visibleCount,
} from './accountStackMotion';

const W = 320;
const FRONT_Y = (n: number) => (visibleCount(n) - 1) * STACK.peek;

describe('visibleCount / stackHeight', () => {
  it('shows at most four cards', () => {
    expect(visibleCount(1)).toBe(1);
    expect(visibleCount(3)).toBe(3);
    expect(visibleCount(4)).toBe(4);
    expect(visibleCount(9)).toBe(4);
  });

  it('is one card tall plus a strip per extra card', () => {
    expect(stackHeight(1)).toBe(STACK.cardHeight);
    expect(stackHeight(4)).toBe(3 * STACK.peek + STACK.cardHeight);
    expect(stackHeight(9)).toBe(stackHeight(4));
  });
});

describe('slotOf', () => {
  it('starts with each account in its own slot', () => {
    expect([0, 1, 2].map((i) => slotOf(i, 0, 3))).toEqual([0, 1, 2]);
  });

  it('sends the back card to the front after a swipe and moves the rest back one', () => {
    expect([0, 1, 2].map((i) => slotOf(i, 1, 3))).toEqual([2, 0, 1]);
  });

  it('wraps after a full lap', () => {
    expect([0, 1, 2].map((i) => slotOf(i, 3, 3))).toEqual([0, 1, 2]);
  });
});

describe.each([2, 3, 4, 5, 7])('cardPose with %i accounts', (n) => {
  const vis = visibleCount(n);
  const at = (slot: number, p: number, dir = 1) => cardPose(slot, n, p, dir, W);

  it('rests with every visible card in its own strip, none lifted or tilted', () => {
    for (let s = 0; s < vis; s++) {
      expect(at(s, 0)).toEqual({ x: 0, y: s * STACK.peek, rotate: 0, scale: 1, opacity: 1, shown: true });
    }
  });

  it('lands each card exactly where the next resting slot has it, so the reorder is invisible', () => {
    // After the swipe, slot s becomes slot s-1 and the back card becomes the last slot.
    for (let s = 1; s < vis; s++) {
      expect(at(s, 1).y).toBeCloseTo((s - 1) * STACK.peek);
    }
    // The card entering from the hidden slot lands in the front slot, fully visible.
    if (n > vis) {
      const entrant = at(vis, 1);
      expect(entrant.y).toBeCloseTo(FRONT_Y(n));
      expect(entrant.opacity).toBe(1);
      expect(entrant.scale).toBeCloseTo(1);
      // And the back card ends up invisible, in the last slot, which is unseen at rest.
      expect(at(0, 1).opacity).toBe(0);
      expect(at(n - 1, 0).opacity).toBe(0);
    } else {
      const back = at(0, 1);
      expect(back.x).toBeCloseTo(0);
      expect(back.y).toBeCloseTo(FRONT_Y(n));
      expect(back.rotate).toBeCloseTo(0);
    }
  });

  it('slides the back card out in the swipe direction, tilting as it goes', () => {
    const half = at(0, STACK.exitEnd / 2, 1);
    expect(half.x).toBeCloseTo(W / 2);
    expect(half.rotate).toBeCloseTo(STACK.tilt / 2);
    const out = at(0, STACK.exitEnd, -1);
    expect(out.x).toBeCloseTo(-W);
    expect(out.rotate).toBeCloseTo(-STACK.tilt);
  });

  it('keeps the back card clear of the stack before it starts back, so it never hides a neighbour', () => {
    expect(at(0, STACK.exitEnd, 1).x).toBe(W);
  });

  it('does not move the cards behind until the swipe has committed', () => {
    for (let s = 1; s < vis; s++) {
      expect(at(s, 0.5 * STACK.commitShare * STACK.exitEnd).y).toBe(s * STACK.peek);
    }
  });

  it('moves the cards behind up smoothly and monotonically', () => {
    for (let s = 1; s < vis; s++) {
      let last = at(s, 0).y;
      for (let p = 0.05; p <= 1.0001; p += 0.05) {
        const y = at(s, p).y;
        expect(y).toBeLessThanOrEqual(last + 1e-9);
        last = y;
      }
    }
  });

  it('never draws a card beyond the window at rest', () => {
    for (let s = vis + (n > vis ? 1 : 0); s < n; s++) {
      expect(at(s, 0).shown).toBe(false);
      expect(at(s, 0).opacity).toBe(0);
    }
    if (n > vis) expect(at(vis, 0).opacity).toBe(0);
  });
});

describe('cardPose with more than four accounts', () => {
  it('fades the leaving card out as it clears the stack, then holds it out of sight', () => {
    expect(cardPose(0, 6, 0.1, 1, W).opacity).toBe(1);
    expect(cardPose(0, 6, 0.3, 1, W).opacity).toBeCloseTo(0.5);
    expect(cardPose(0, 6, 0.4, 1, W).opacity).toBeCloseTo(0);
    expect(cardPose(0, 6, 0.7, 1, W).opacity).toBe(0);
  });

  it('rises the next account in from below once the leaving card is clear', () => {
    const before = cardPose(4, 6, STACK.exitEnd, 1, W);
    expect(before.opacity).toBe(0);
    expect(before.y).toBeCloseTo(FRONT_Y(6) + STACK.enterRise);
    const mid = cardPose(4, 6, 0.7, 1, W);
    expect(mid.opacity).toBeGreaterThan(0);
    expect(mid.y).toBeLessThan(before.y);
  });
});

describe('dragProgress', () => {
  it('maps the drag distance onto the slide-out part of the swipe', () => {
    expect(dragProgress(0, W)).toBe(0);
    expect(dragProgress(W / 2, W)).toBeCloseTo(STACK.exitEnd / 2);
    expect(dragProgress(-W / 2, W)).toBeCloseTo(STACK.exitEnd / 2);
  });

  it('stops at the edge of the slide-out however far the finger goes', () => {
    expect(dragProgress(W * 3, W)).toBe(STACK.exitEnd);
  });

  it('is zero before the stack has been measured', () => {
    expect(dragProgress(100, 0)).toBe(0);
  });
});

describe('shouldCommit', () => {
  const past = STACK.commitShare * STACK.exitEnd;

  it('commits a drag released past the threshold, and springs back one that is short of it', () => {
    expect(shouldCommit(past, 0, 1)).toBe(true);
    expect(shouldCommit(past * 0.9, 0, 1)).toBe(false);
  });

  it('commits a short drag that was a quick flick the same way', () => {
    expect(shouldCommit(0.06, 0.8, 1)).toBe(true);
    expect(shouldCommit(0.06, -0.8, -1)).toBe(true);
  });

  it('ignores a flick the other way, a slow drag and a tap-sized nudge', () => {
    expect(shouldCommit(0.06, -0.8, 1)).toBe(false);
    expect(shouldCommit(0.06, 0.2, 1)).toBe(false);
    expect(shouldCommit(0.01, 2, 1)).toBe(false);
  });
});
