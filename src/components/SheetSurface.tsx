import { createContext, useContext } from 'react';

const SheetSurfaceContext = createContext(false);
export const SheetSurfaceProvider = SheetSurfaceContext.Provider;

/** Scope sheet fields and disclosures without changing their full-page counterparts. */
export function useSheetSurface() {
  return useContext(SheetSurfaceContext);
}
