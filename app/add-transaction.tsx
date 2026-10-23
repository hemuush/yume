import { AddEntryView } from '@/features/add/components/AddEntryView';
import { useAddEntryModel } from '@/features/add/hooks/useAddEntryModel';
import type { ReactElement } from 'react';
export default function AddTransactionScreen(): ReactElement {
  const model = useAddEntryModel();
  return <AddEntryView model={model} />;
}
