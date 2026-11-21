import { getAddStyle } from '@/db/settings';
import { pushOnce } from '@/lib/pushOnce';

/**
 * The + button: opens Add the way the person chose in Profile (the form, or the chat). A read that fails opens the
 * form: the + button must always work. Links that arrive with a prefill (an entry to edit, a category) go to the
 * form themselves and do not come through here.
 */
export async function openAdd(): Promise<void> {
  const style = await getAddStyle().catch(() => 'form' as const);
  pushOnce(style === 'chat' ? '/add-chat' : '/add-transaction');
}
