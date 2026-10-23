import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { FlexWidget } from 'react-native-android-widget';
import app from '../../app.json';
import { QuickAddWidget } from './QuickAddWidget';

const categories = ['Food', 'Travel', 'Grocery', 'Cafe'].map((name) => ({
  id: name === 'Cafe' ? 'cafe & tea' : name.toLowerCase(),
  name,
  icon: 'coffee',
  color: '#F0876A',
}));

it('keeps all seven Quick Add links with at least 44dp bounds at its native minimum', () => {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(<QuickAddWidget primary="#8FCBFF" categories={categories} />);
  });
  if (!tree) throw new Error('Widget did not render');
  const containers = tree.root.findAllByType(FlexWidget);
  const actions = containers.filter((node) => node.props.clickAction === 'OPEN_URI');
  expect(actions.map((node) => node.props.clickActionData.uri)).toEqual([
    'yume://add-transaction?type=expense',
    ...categories.map(
      (category) => `yume://add-transaction?type=expense&categoryId=${encodeURIComponent(category.id)}`
    ),
    'yume://add-transaction?type=income',
    'yume://add-transaction?type=transfer',
  ]);
  const plugin = app.expo.plugins.find(
    (entry) => Array.isArray(entry) && entry[0] === 'react-native-android-widget'
  );
  if (!Array.isArray(plugin) || typeof plugin[1] !== 'object' || !('widgets' in plugin[1])) {
    throw new Error('Widget metadata missing');
  }
  const metadata = plugin[1].widgets.find((widget) => widget.name === 'QuickAdd');
  if (!metadata) throw new Error('Quick Add metadata missing');
  const shell = containers[0].props.style;
  const innerWidth = parseInt(metadata.minWidth, 10) - 2 * (shell.padding + shell.borderWidth);
  const innerHeight = parseInt(metadata.minHeight, 10) - 2 * (shell.padding + shell.borderWidth);
  for (const action of actions) expect(action.props.style.height).toBeGreaterThanOrEqual(44);
  expect(innerWidth / categories.length).toBeGreaterThanOrEqual(44);
  expect((innerWidth - 6) / 2).toBeGreaterThanOrEqual(44);
  const categoryHeight = actions[1].props.style.height;
  expect(actions[0].props.style.height + categoryHeight + actions[5].props.style.height).toBeLessThanOrEqual(
    innerHeight
  );
  expect(metadata.targetCellWidth).toBeGreaterThanOrEqual(3);
  expect(metadata.targetCellHeight).toBeGreaterThanOrEqual(3);
  act(() => tree?.unmount());
});
