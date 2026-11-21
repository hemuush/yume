const mockStyle = jest.fn();
jest.mock('@/db/settings', () => ({ getAddStyle: () => mockStyle() }));
const mockPush = jest.fn();
jest.mock('@/lib/pushOnce', () => ({ pushOnce: (href: string) => mockPush(href) }));

import { openAdd } from './openAdd';

beforeEach(() => jest.clearAllMocks());

describe('the + button', () => {
  it('opens the form by default', async () => {
    mockStyle.mockResolvedValue('form');
    await openAdd();
    expect(mockPush).toHaveBeenCalledWith('/add-transaction');
  });
  it('opens the chat when that is the chosen way', async () => {
    mockStyle.mockResolvedValue('chat');
    await openAdd();
    expect(mockPush).toHaveBeenCalledWith('/add-chat');
  });
  it('opens the form when the setting cannot be read: + must always work', async () => {
    mockStyle.mockRejectedValue(new Error('db busy'));
    await openAdd();
    expect(mockPush).toHaveBeenCalledWith('/add-transaction');
  });
});
