/** Which of Home's sheets are open: kept outside React state so opening one does not redraw the page. */
import type { Account, Transaction } from '@/types';
import { createHomeSheets } from './homeSheetsStore';

const bank = { id: 'bank', name: 'Bank' } as Account;
const cash = { id: 'cash', name: 'Cash' } as Account;
const tea = { id: 'tea' } as Transaction;

it('starts with every sheet closed', () => {
  expect(createHomeSheets().get()).toEqual({ account: null, editing: null, entry: null, adding: false });
});

it('opens and closes an account’s summary', () => {
  const sheets = createHomeSheets();
  sheets.openAccount(bank);
  expect(sheets.get().account).toBe(bank);
  sheets.closeAccount();
  expect(sheets.get().account).toBeNull();
});

it('hands the summary over to the edit form', () => {
  const sheets = createHomeSheets();
  sheets.openAccount(bank);
  sheets.editAccount(bank);
  expect(sheets.get()).toMatchObject({ account: null, editing: bank });
  sheets.closeEditing();
  expect(sheets.get().editing).toBeNull();
});

it('puts a summary away when an entry is opened, as the entry is what was asked for', () => {
  const sheets = createHomeSheets();
  sheets.openAccount(cash);
  sheets.openEntry(tea);
  expect(sheets.get()).toMatchObject({ account: null, entry: tea });
  sheets.closeEntry();
  expect(sheets.get().entry).toBeNull();
});

it('opens and closes the new-account form', () => {
  const sheets = createHomeSheets();
  sheets.openAddAccount();
  expect(sheets.get().adding).toBe(true);
  sheets.closeAddAccount();
  expect(sheets.get().adding).toBe(false);
});

it('tells subscribers on every change, and stops once they unsubscribe', () => {
  const sheets = createHomeSheets();
  const listener = jest.fn();
  const off = sheets.subscribe(listener);
  sheets.openAccount(bank);
  sheets.closeAccount();
  expect(listener).toHaveBeenCalledTimes(2);
  off();
  sheets.openAddAccount();
  expect(listener).toHaveBeenCalledTimes(2);
});
