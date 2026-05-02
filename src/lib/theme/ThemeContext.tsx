'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  effectiveTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');
  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>('light');

  // Inicializar tema ao montar
  useEffect(() => {
    // Restaurar preferência salva
    const saved = localStorage.getItem('theme') as Theme | null;
    const initialTheme = saved || 'system';
    setThemeState(initialTheme);

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
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      return isDark ? 'dark' : 'light';
    }
    return t;
  };

  const applyTheme = (effective: 'light' | 'dark') => {
    const root = document.documentElement;
    root.setAttribute('data-theme', effective);
    root.style.colorScheme = effective;
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const toggleTheme = () => {
    const newTheme: Theme = effectiveTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  };

  // Sempre renderizar com contexto (evita erro de context missing)
  return (
    <ThemeContext.Provider value={{ theme, effectiveTheme, setTheme, toggleTheme }}>
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
