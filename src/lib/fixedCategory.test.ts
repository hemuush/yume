import { isFixedCategoryName } from './fixedCategory';

it('counts an EMI, rent, insurance and subscriptions as fixed, and ordinary spending as a choice', () => {
  for (const name of ['Loan EMI', 'Rent', 'Insurance', 'Subscriptions'])
    expect(isFixedCategoryName(name)).toBe(true);
  for (const name of ['Food', 'Fun', 'Groceries', 'rent', 'Rent & Utilities'])
    expect(isFixedCategoryName(name)).toBe(false);
});
