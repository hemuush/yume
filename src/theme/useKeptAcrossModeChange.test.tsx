import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { applyScheme } from './scheme';
import { useKeptAcrossModeChange } from './useKeptAcrossModeChange';

const mount = (id: string) => {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(<Probe id={id} />);
  });
  return r;
};
let setTab!: (value: string) => void;
let tab = '';
function Probe({ id }: { id: string }) {
  const [value, set] = useKeptAcrossModeChange(id, 'you');
  tab = value;
  setTab = set;
  return null;
}

afterEach(() => {
  jest.useRealTimers();
  applyScheme('light');
});

it('starts from the initial value when the screen is opened afresh', () => {
  const r = mount('fresh');
  expect(tab).toBe('you');
  act(() => setTab('settings'));
  expect(tab).toBe('settings');
  act(() => r.unmount());
  // Leaving and coming back (no colour-mode change) starts over.
  const again = mount('fresh');
  expect(tab).toBe('you');
  act(() => again.unmount());
});

it('picks the choice up again when the screen is drawn again for a colour-mode change', () => {
  const r = mount('mode');
  act(() => setTab('settings'));
  act(() => r.unmount());
  act(() => {
    applyScheme('dark');
  });
  const again = mount('mode');
  expect(tab).toBe('settings');
  act(() => again.unmount());
});

it('does not pick it up once the change was a while ago', () => {
  jest.useFakeTimers();
  const r = mount('late');
  act(() => setTab('settings'));
  act(() => r.unmount());
  act(() => {
    applyScheme('dark');
  });
  jest.advanceTimersByTime(5000);
  const again = mount('late');
  expect(tab).toBe('you');
  act(() => again.unmount());
});
