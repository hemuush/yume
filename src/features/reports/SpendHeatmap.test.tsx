import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import type { ReactNode } from 'react';
import { SpendHeatmap } from './SpendHeatmap';
import { buildHeat } from './reportsInsights';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@expo/vector-icons/Feather', () => () => null);
jest.mock('@/theme/AccentContext', () => ({ useAccent: () => ({ accent: '#8FCBFF' }) }));
// The native sheet/window is the boundary; all date filtering and selection runs normally.
jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: ({ visible, children }: { visible: boolean; children: ReactNode }) =>
    visible ? children : null,
}));

const year = buildHeat({
  range: { start: '2026-01-01', end: '2026-12-31' },
  daily: [],
  today: '2026-10-23',
});

it('gives calendar day buttons at least 44dp in each direction', async () => {
  const calendar = buildHeat({
    range: { start: '2026-10-01', end: '2026-10-31' },
    daily: [],
    today: '2026-10-23',
  });
  const select = jest.fn();
  await render(
    <SpendHeatmap model={calendar} selectedIso={null} onSelect={select} usualMinor={0} hue="#8FCBFF" />
  );
  const day = screen.getByRole('button', { name: '5 Oct, nothing spent' });
  const style = StyleSheet.flatten(day.props.style);
  expect(style.minWidth).toBeGreaterThanOrEqual(44);
  expect(style.minHeight).toBeGreaterThanOrEqual(44);
  await fireEvent.press(day);
  expect(select).toHaveBeenCalledWith('2026-10-05');
});

it('selects a year-view day through a full-size searchable row', async () => {
  const select = jest.fn();
  await render(
    <SpendHeatmap model={year} selectedIso={null} onSelect={select} usualMinor={0} hue="#8FCBFF" />
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Choose day or month' }));
  await fireEvent.changeText(screen.getByLabelText('Find a day'), '5 Oct 2026');
  const day = screen.getByRole('button', { name: '5 Oct, nothing spent, 2026' });
  expect(StyleSheet.flatten(day.props.style).minHeight).toBeGreaterThanOrEqual(44);
  await fireEvent.press(day);
  expect(select).toHaveBeenCalledWith('2026-10-05');
  expect(screen.queryByLabelText('Find a day')).toBeNull();
});

it('keeps month navigation available through a full-size month row', async () => {
  const openMonth = jest.fn();
  await render(
    <SpendHeatmap
      model={year}
      selectedIso={null}
      onSelect={jest.fn()}
      onOpenMonth={openMonth}
      usualMinor={0}
      hue="#8FCBFF"
    />
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Choose day or month' }));
  await fireEvent.changeText(screen.getByLabelText('Find a day'), 'October');
  const month = screen.getByRole('button', { name: 'Open October 2026' });
  expect(StyleSheet.flatten(month.props.style).minHeight).toBeGreaterThanOrEqual(44);
  await fireEvent.press(month);
  expect(openMonth).toHaveBeenCalledWith('2026-10');
});

it('shows an empty search result instead of offering future days', async () => {
  await render(
    <SpendHeatmap model={year} selectedIso={null} onSelect={jest.fn()} usualMinor={0} hue="#8FCBFF" />
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Choose day or month' }));
  await fireEvent.changeText(screen.getByLabelText('Find a day'), '31 Dec 2026');
  expect(screen.getByText('No matching days')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: /31 Dec/ })).toBeNull();
});
