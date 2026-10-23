import { createAddEntryActions } from '@/features/add/api/createAddEntryActions';
import { createAddEntrySaveActions } from '@/features/add/api/createAddEntrySaveActions';
import { createAddEntrySaveCompletion } from '@/features/add/api/createAddEntrySaveCompletion';
import { createAddEntryStagingActions } from '@/features/add/api/createAddEntryStagingActions';
import { getAddEntryPresentation } from '@/features/add/utils/getAddEntryPresentation';
import { useAddDraftWorkflow } from '@/features/add/hooks/useAddDraftWorkflow';
import { useAddEntryData } from '@/features/add/hooks/useAddEntryData';
import { useAddEntryDerived } from '@/features/add/hooks/useAddEntryDerived';
import { useAddEntryEnvironment } from '@/features/add/hooks/useAddEntryEnvironment';
import { useAddEntryState } from '@/features/add/hooks/useAddEntryState';
import { useAddEntrySuggestions } from '@/features/add/hooks/useAddEntrySuggestions';

/** Composes the Add route's local state, data and commands; views receive no repository dependencies. */
export function useAddEntryModel() {
  const environment = useAddEntryEnvironment();
  const state = useAddEntryState({ environment });
  const draft = useAddDraftWorkflow({ state, environment });
  const suggestions = useAddEntrySuggestions({ state, environment });
  const loader = useAddEntryData({ state, environment });
  const derived = useAddEntryDerived({ state });
  const staging = createAddEntryStagingActions({ state, loader, draft, derived });
  const completion = createAddEntrySaveCompletion({ state, environment, draft });
  const save = createAddEntrySaveActions({ state, draft, derived, environment, completion, staging });
  const navigation = createAddEntryActions({ state, draft, derived, environment });
  const display = getAddEntryPresentation({ environment, state, draft, derived, staging });
  return {
    ...environment,
    ...state,
    ...draft,
    ...suggestions,
    ...loader,
    ...derived,
    ...staging,
    ...completion,
    ...save,
    ...navigation,
    ...display,
  };
}
