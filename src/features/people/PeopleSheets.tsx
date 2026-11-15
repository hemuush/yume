import { memo } from 'react';
import { AddPersonModal } from './AddPersonModal';
import { PersonDetailModal } from './PersonDetailModal';
import { usePeopleSheets, type PeopleSheets as PeopleSheetsStore } from './peopleSheetsStore';

/**
 * The sheets the Friends & family page opens: the new-person form and a person's sheet. Which is open lives in `sheets`,
 * so the page behind does not redraw when one opens or closes.
 */
export const PeopleSheets = memo(function PeopleSheets({
  sheets,
  reload,
}: {
  sheets: PeopleSheetsStore;
  /** Reloads the page in place after something was saved. */
  reload: () => Promise<void>;
}) {
  const { adding, person } = usePeopleSheets(sheets);
  return (
    <>
      <AddPersonModal
        visible={adding}
        onClose={sheets.closeAdd}
        onCreated={async () => {
          sheets.closeAdd();
          await reload();
        }}
      />
      {person && <PersonDetailModal person={person} onClose={sheets.closePerson} onChanged={reload} />}
    </>
  );
});
