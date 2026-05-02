'use client';

import { createContext, useContext, useEffect, useState, useMemo } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  effectiveTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

interface ThemeProviderProps {
  readonly children: React.ReactNode;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>('light');
  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>('light');

  // Inicializar tema ao montar
  useEffect(() => {
    // Restaurar preferência salva
    const saved = localStorage.getItem('theme') as Theme | null;
    const initialTheme = saved ?? 'system';
    setTheme(initialTheme);

    // Computar tema efetivo imediatamente
    const computedEffective = computeEffectiveTheme(initialTheme);
    setEffectiveTheme(computedEffective);
    applyTheme(computedEffective);
  }, []);

  // Atualizar quando tema muda
  useEffect(() => {
    const computed = computeEffectiveTheme(theme);
    setEffectiveTheme(computed);
    applyTheme(computed);
  }, [theme]);

  const computeEffectiveTheme = (t: Theme): 'light' | 'dark' => {
    if (t === 'system') {
      const isDark = globalThis.matchMedia('(prefers-color-scheme: dark)').matches;
      return isDark ? 'dark' : 'light';
    }
    return t;
  };

  const applyTheme = (effective: 'light' | 'dark') => {
    const root = document.documentElement;
    root.dataset.theme = effective;
    root.style.colorScheme = effective;
  };

  const setThemeValue = (newTheme: Theme) => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const toggleTheme = () => {
    const newTheme: Theme = effectiveTheme === 'light' ? 'dark' : 'light';
    setThemeValue(newTheme);
  };

  const value = useMemo(() => ({
    theme,
    effectiveTheme,
    setTheme: setThemeValue,
    toggleTheme,
  }), [theme, effectiveTheme]);

  // Sempre renderizar com contexto (evita erro de context missing)
  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme deve ser usado dentro de ThemeProvider');
  }
  return context;
}
