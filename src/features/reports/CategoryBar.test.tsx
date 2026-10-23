import { act, create, ReactTestRenderer, ReactTestRendererJSON } from 'react-test-renderer';
import { StyleSheet } from 'react-native';
import { CategoryBar } from './CategoryBar';
import { theme } from '@/constants/theme';
import type { CategoryBreakdownItem } from '@/db/reports';

const item = (id: string, totalMinor: number, color: string) =>
  ({ categoryId: id, name: id, totalMinor, color }) as CategoryBreakdownItem;

const BIG = [item('rent', 60_000, '#aa0000'), item('food', 30_000, '#00aa00')];
const THIN = [item('fee', 500, '#111111'), item('misc', 400, '#222222'), item('gift', 300, '#333333')];

function segments(breakdown: CategoryBreakdownItem[], selectedId: string | null = null) {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(<CategoryBar breakdown={breakdown} selectedId={selectedId} />);
  });
  const bar = tree.toJSON() as ReactTestRendererJSON;
  const segs = (bar.children ?? []).map((c) => StyleSheet.flatten((c as ReactTestRendererJSON).props.style));
  act(() => tree.unmount());
  return segs as { backgroundColor: string; flexGrow: number; opacity: number }[];
}

describe('CategoryBar', () => {
  it('gives each sizeable category its own segment', () => {
    expect(segments(BIG).map((s) => s.backgroundColor)).toEqual(['#aa0000', '#00aa00']);
  });

  it('joins categories under 2% each into one grey segment at the end', () => {
    const segs = segments([...BIG, ...THIN]);
    expect(segs.map((s) => s.backgroundColor)).toEqual(['#aa0000', '#00aa00', theme.colors.otherSlice]);
    expect(segs[2].flexGrow).toBe(1200);
  });

  it('keeps a single thin category in its own colour', () => {
    const segs = segments([...BIG, THIN[0]]);
    expect(segs.map((s) => s.backgroundColor)).toEqual(['#aa0000', '#00aa00', '#111111']);
  });

  it('keeps the picked category as its own segment even when it is thin, and fades the rest', () => {
    const segs = segments([...BIG, ...THIN], 'misc');
    expect(segs.map((s) => s.backgroundColor)).toEqual([
      '#aa0000',
      '#00aa00',
      '#222222',
      theme.colors.otherSlice,
    ]);
    expect(segs.map((s) => s.opacity)).toEqual([0.3, 0.3, 1, 0.3]);
  });
});
