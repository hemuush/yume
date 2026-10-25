jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

import { router } from 'expo-router';
import { pushOnce } from './pushOnce';

afterEach(() => jest.restoreAllMocks());

it('blocks duplicate taps and allows navigation after the guard expires', () => {
  const now = jest.spyOn(Date, 'now').mockReturnValue(10000);
  pushOnce('/add-transaction');
  pushOnce('/add-transaction');
  expect(router.push).toHaveBeenCalledTimes(1);
  now.mockReturnValue(10700);
  pushOnce('/add-transaction');
  expect(router.push).toHaveBeenCalledTimes(2);
});

it('allows a new action after the device clock moves backwards', () => {
  const now = jest.spyOn(Date, 'now').mockReturnValue(20000);
  pushOnce('/add-transaction');
  now.mockReturnValue(5000);
  pushOnce('/add-transaction');
  expect(router.push).toHaveBeenCalledTimes(2);
});
