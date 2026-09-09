import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getAccentColor, setAccentColor, getCachedAccentColor } from '@/db/settings';

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)];
}

// Picks black or white text so it stays readable on whatever accent color
// the user picks — a light accent (white, mint, sky) needs dark text; a dark
// one (ink) needs light text.
function contrastColor(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#12130F' : '#FFFDF6';
}

interface AccentContextValue {
  accent: string;
  onAccent: string;
  setAccent: (hex: string) => void;
}

const AccentContext = createContext<AccentContextValue>({
  accent: getCachedAccentColor(),
  onAccent: contrastColor(getCachedAccentColor()),
  setAccent: () => {},
});

export function AccentProvider({ children }: { children: ReactNode }) {
  const [accent, setAccentState] = useState(getCachedAccentColor());

  useEffect(() => {
    getAccentColor().then(setAccentState);
  }, []);

  const setAccent = (hex: string) => {
    setAccentState(hex);
    void setAccentColor(hex);
  };

  return (
    <AccentContext.Provider value={{ accent, onAccent: contrastColor(accent), setAccent }}>
      {children}
    </AccentContext.Provider>
  );
}

export function useAccent(): AccentContextValue {
  return useContext(AccentContext);
}
