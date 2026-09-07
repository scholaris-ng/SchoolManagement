import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { localStore, storageKeys } from '@/lib/storage';
import { useAuth } from './auth-provider';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  mode: ThemeMode;
  resolved: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** `#4f46e5` -> `243 75% 59%`, the form Tailwind's tokens expect. */
function hexToHsl(hex: string): string | null {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!match) return null;

  const r = parseInt(match[1], 16) / 255;
  const g = parseInt(match[2], 16) / 255;
  const b = parseInt(match[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;

  if (max === min) return `0 0% ${Math.round(lightness * 100)}%`;

  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);

  let hue: number;
  if (max === r) hue = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
  else if (max === g) hue = ((b - r) / delta + 2) / 6;
  else hue = ((r - g) / delta + 4) / 6;

  return `${Math.round(hue * 360)} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%`;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() =>
    localStore.get<ThemeMode>(storageKeys.theme, 'system'),
  );
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false,
  );

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, []);

  const resolved: 'light' | 'dark' = mode === 'system' ? (systemDark ? 'dark' : 'light') : mode;

  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
  }, [resolved]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    localStore.set(storageKeys.theme, next);
  }, []);

  const value = useMemo(() => ({ mode, resolved, setMode }), [mode, resolved, setMode]);

  return (
    <ThemeContext.Provider value={value}>
      <BrandingBridge />
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Applies the active school's brand colour to the CSS variables the whole
 * design system reads from (research feature 12 — school branding). Switching
 * school re-skins the app without a reload or a rebuild.
 */
function BrandingBridge() {
  const { membership } = useAuth();
  const branding = membership?.branding;

  useEffect(() => {
    const root = document.documentElement;
    const primary = branding?.primaryColor ? hexToHsl(branding.primaryColor) : null;

    if (primary) {
      root.style.setProperty('--primary', primary);
      root.style.setProperty('--ring', primary);
      const [hue, saturation] = primary.split(' ');
      root.style.setProperty('--primary-subtle', `${hue} ${saturation} 96%`);
    } else {
      root.style.removeProperty('--primary');
      root.style.removeProperty('--ring');
      root.style.removeProperty('--primary-subtle');
    }

    const accent = branding?.accentColor ? hexToHsl(branding.accentColor) : null;
    if (accent) root.style.setProperty('--info', accent);
    else root.style.removeProperty('--info');
  }, [branding?.primaryColor, branding?.accentColor]);

  useEffect(() => {
    if (!membership) return;
    document.title = `${membership.schoolShortName} · Scholaris`;
  }, [membership]);

  return null;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside <ThemeProvider>.');
  return context;
}
